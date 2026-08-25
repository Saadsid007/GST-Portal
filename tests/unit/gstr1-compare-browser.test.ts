import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { compareGstr1InBrowser } from "@/features/convert/engine/comparison/compare-in-browser";
import { toComparableRow } from "@/features/convert/engine/comparison/gstr1.comparator";
import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";

/**
 * The reference workbook is parsed locally. Uploading it was impossible: the
 * Government template is ~7 MB against a 4.5 MB platform request limit, which
 * is why this failed only on the deployed site.
 */
const TEMPLATE = path.resolve(
  __dirname,
  "../../Sample/new 19/GSTR1_Excel_Workbook_Template_V2.1.xlsx"
);

function fileFrom(diskPath: string): File {
  const bytes = fs.readFileSync(diskPath);
  return new File([new Uint8Array(bytes)], path.basename(diskPath), {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function row(over: Partial<NormalizedInvoiceRow> = {}): NormalizedInvoiceRow {
  return {
    id: crypto.randomUUID(),
    rowIndex: 0,
    transactionType: "Sales",
    invoiceNumber: "2026-2027/57",
    invoiceDate: "2026-07-01",
    invoiceType: "B2B",
    buyerName: "eTrade Marketing Private Limited",
    buyerGstin: "06AADCV4254H1ZC",
    placeOfSupply: "06",
    hsnCode: "441900",
    itemDescription: "Wooden tray",
    uqc: "NOS",
    quantity: 210,
    taxableValue: 35868,
    igstRate: 5,
    cgstRate: 0,
    sgstRate: 0,
    cessRate: 0,
    igstAmount: 1793.4,
    cgstAmount: 0,
    sgstAmount: 0,
    cessAmount: 0,
    totalValue: 37661.4,
    errors: [],
    ...over,
  } as NormalizedInvoiceRow;
}

describe("GSTR-1 comparison in the browser", () => {
  it("parses a reference template far larger than the upload limit", async () => {
    const sizeMb = fs.statSync(TEMPLATE).size / (1024 * 1024);
    // Guards the premise: if the template ever shrinks below the limit, the
    // reason this runs client-side stops being obvious.
    expect(sizeMb).toBeGreaterThan(4.5);

    const result = await compareGstr1InBrowser([toComparableRow(row())], fileFrom(TEMPLATE));

    expect(result.success, JSON.stringify(result)).toBe(true);
    if (!result.success) return;
    expect(result.data.sourceLabel).toBe("Government GSTR-1 Template V2.1");
    expect(result.data.totalRefInvoices).toBeGreaterThan(0);
  }, 120000);

  it("matches an invoice that is present on both sides", async () => {
    const result = await compareGstr1InBrowser([toComparableRow(row())], fileFrom(TEMPLATE));

    expect(result.success).toBe(true);
    if (!result.success) return;

    const ours = result.data.b2bRows.find((r) => r.invoiceNumber === "2026-2027/57");
    expect(ours, "the CA's return contains this invoice").toBeDefined();
    expect(ours!.status).toBe("matched");
  }, 120000);

  it("reports a file with no GSTR-1 data rather than failing silently", async () => {
    const notATemplate = new File([new Uint8Array([1, 2, 3, 4])], "notes.txt", {
      type: "text/plain",
    });

    const result = await compareGstr1InBrowser([toComparableRow(row())], notATemplate);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/could not read|no gstr-1 data/i);
  }, 30000);
});
