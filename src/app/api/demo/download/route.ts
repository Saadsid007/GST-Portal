import { NextResponse, type NextRequest } from "next/server";
import { generateGstr1Json } from "@/features/convert/domain/gstr1-json.generator";
import { generateGstr1Excel } from "@/features/convert/domain/gstr1-excel.generator";
import { generateCaReviewReport } from "@/features/convert/domain/ca-review-report.generator";
import type { ConversionSummary } from "@/features/convert/types/convert.types";
import { DEMO_ROWS, DEMO_SELLER, DEMO_TOTALS } from "@/features/demo/demo-data";

/**
 * Demo downloads for the public homepage.
 *
 * These run the *production* generators over the demo rows, so a visitor gets a
 * genuinely representative GSTR-1 JSON, GSTN workbook and CA review report
 * rather than a hand-written sample that could drift from the real output.
 *
 * Server-side on purpose: `xlsx` and `exceljs` together are megabytes, and
 * generating these in the browser would put all of it in the homepage bundle
 * for a feature most visitors never trigger.
 *
 * Public and unauthenticated because the data is fixed and fictional — nothing
 * here reads the request's user. Every file is watermarked as a demo.
 */

const FILES = ["json", "excel", "review"] as const;
type DemoFile = (typeof FILES)[number];

function isDemoFile(value: string | null): value is DemoFile {
  return value !== null && (FILES as readonly string[]).includes(value);
}

/** The demo rows are already netted, so sales totals are the net totals. */
function demoStatement(): ConversionSummary {
  const sum = (pick: (r: (typeof DEMO_ROWS)[number]) => number) =>
    +DEMO_ROWS.reduce((total, row) => total + pick(row), 0).toFixed(2);

  const cgst = sum((r) => r.cgstAmount);
  const sgst = sum((r) => r.sgstAmount);
  const igst = sum((r) => r.igstAmount);
  const taxable = DEMO_TOTALS.netTaxable;
  const tax = DEMO_TOTALS.totalTax;

  const byPlatform = new Map<string, { taxable: number; tax: number; count: number }>();
  for (const row of DEMO_ROWS) {
    const name = row.sourcePlatformName ?? "Unknown";
    const entry = byPlatform.get(name) ?? { taxable: 0, tax: 0, count: 0 };
    entry.taxable = +(entry.taxable + row.taxableValue).toFixed(2);
    entry.tax = +(entry.tax + row.cgstAmount + row.sgstAmount + row.igstAmount).toFixed(2);
    entry.count += 1;
    byPlatform.set(name, entry);
  }

  return {
    totalInvoices: DEMO_ROWS.length,
    validInvoices: DEMO_ROWS.length,
    errorInvoices: 0,
    reviewInvoices: 0,

    totalSalesTaxable: taxable,
    totalSalesCgst: cgst,
    totalSalesSgst: sgst,
    totalSalesIgst: igst,
    totalSalesCess: 0,
    totalSalesTax: tax,

    totalReturnTaxable: 0,
    totalReturnCgst: 0,
    totalReturnSgst: 0,
    totalReturnIgst: 0,
    totalReturnCess: 0,
    totalReturnTax: 0,

    netTaxable: taxable,
    netCgst: cgst,
    netSgst: sgst,
    netIgst: igst,
    netCess: 0,
    netTax: tax,
    netGrandTotal: DEMO_TOTALS.grossValue,

    b2bCount: 0,
    b2clCount: 0,
    b2csCount: DEMO_ROWS.length,
    cdnrCount: 0,
    expCount: 0,

    b2bNetTaxable: 0,
    b2clNetTaxable: 0,
    b2csNetTaxable: taxable,
    cdnrNetTaxable: 0,
    expNetTaxable: 0,

    // Demo rows are pre-netted, so sales figures are the net figures and the
    // return columns are zero.
    platformContributions: [...byPlatform.entries()].map(([platformName, v]) => ({
      platformId: platformName.toLowerCase(),
      platformName,
      totalInvoices: v.count,
      salesCount: v.count,
      returnCount: 0,
      salesTaxable: v.taxable,
      salesTax: v.tax,
      returnTaxable: 0,
      returnTax: 0,
      netTaxable: v.taxable,
      netTax: v.tax,
    })),
    issues: [],
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const file = request.nextUrl.searchParams.get("file");
  if (!isDemoFile(file)) {
    return NextResponse.json({ error: `file must be one of ${FILES.join(", ")}` }, { status: 400 });
  }

  const { gstin, returnPeriod } = DEMO_SELLER;
  const stem = `GSTPilot_DEMO_${returnPeriod}`;

  // Watermarked: this output must never be mistaken for a filed return.
  const WATERMARK = true;

  try {
    if (file === "json") {
      const json = generateGstr1Json(DEMO_ROWS, gstin, returnPeriod, demoStatement(), WATERMARK);
      return new NextResponse(json, {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${stem}_GSTR1.json"`,
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    const bytes =
      file === "excel"
        ? generateGstr1Excel(DEMO_ROWS, gstin, returnPeriod, WATERMARK)
        : await generateCaReviewReport(DEMO_ROWS, gstin, returnPeriod, undefined, WATERMARK);

    const suffix = file === "excel" ? "GSTR1_Workbook" : "CA_Review_Report";
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${stem}_${suffix}.xlsx"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Could not generate the demo file" }, { status: 500 });
  }
}
