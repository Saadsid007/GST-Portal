import { describe, it, expect, beforeAll } from "vitest";
import * as XLSX from "xlsx";
import { generateGstr1Excel } from "@/features/convert/domain/gstr1-excel.generator";
import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";

const SUPPLIER = "09BHCPS1644C1ZI";

function row(over: Partial<NormalizedInvoiceRow>): NormalizedInvoiceRow {
  return {
    id: crypto.randomUUID(),
    rowIndex: 0,
    sourcePlatformId: "amazon",
    sourcePlatformName: "Amazon",
    sourceFileName: "mtr.csv",
    sourceFileType: "b2b",
    transactionType: "Sales",
    invoiceNumber: "IN-707",
    invoiceDate: "2026-07-01",
    invoiceType: "B2B",
    buyerName: "Buyer",
    buyerGstin: "06AADCV4254H1ZC",
    placeOfSupply: "06",
    hsnCode: "441900",
    itemDescription: "Wooden tray",
    uqc: "NOS",
    quantity: 1,
    taxableValue: 1000,
    igstRate: 5,
    cgstRate: 0,
    sgstRate: 0,
    cessRate: 0,
    igstAmount: 50,
    cgstAmount: 0,
    sgstAmount: 0,
    cessAmount: 0,
    totalValue: 1050,
    errors: [],
    ...over,
  } as NormalizedInvoiceRow;
}

type Grid = string[][];

/**
 * Building the workbook means loading and rewriting the 7 MB GSTN template, so
 * each scenario is generated once in beforeAll and asserted against several
 * times. Generating per assertion made the suite flaky under parallel load.
 */
async function build(rows: NormalizedInvoiceRow[]): Promise<Record<string, Grid>> {
  const bytes = await generateGstr1Excel(rows, SUPPLIER, "072026");
  const wb = XLSX.read(bytes, { type: "buffer" });
  const read = (name: string): Grid =>
    XLSX.utils.sheet_to_json<string[]>(wb.Sheets[name]!, { header: 1, raw: false, defval: "" });
  return { hsnB2b: read("hsn(b2b)"), docs: read("docs") };
}

/** Data rows begin at index 4; rows 0-3 are the template's header block. */
const dataRows = (grid: Grid) => grid.slice(4).filter((r) => String(r[0] ?? "").trim());

describe("GSTR-1 workbook: HSN summary (Table 12)", () => {
  let plain: Record<string, Grid>;
  let mixed: Record<string, Grid>;

  beforeAll(async () => {
    plain = await build([
      row({ itemDescription: "Wooden serving tray" }),
      row({ invoiceNumber: "IN-708", itemDescription: "Wooden coaster set" }),
    ]);
    mixed = await build([
      row({ hsnCode: "4419" }),
      row({ hsnCode: "441900", invoiceNumber: "IN-708" }),
      row({ hsnCode: "000000", invoiceNumber: "IN-709" }),
    ]);
  }, 180000);

  it("fills the tax totals behind the shared formula", () => {
    // The template writes G3:K3 as one shared formula, with H3:K3 carrying a
    // self-closing <f/>. Those cells used to keep the blank template's cached
    // zero, so every return shipped claiming no tax while the rows showed tax.
    const summary = plain.hsnB2b![2]!;
    expect(Number(summary[6])).toBeCloseTo(2000, 2); // taxable
    expect(Number(summary[7]), "integrated tax total must not be zero").toBeCloseTo(100, 2);
  });

  it("writes zero rather than a blank where there is no tax", () => {
    // A blank reads as missing data; a zero states the fact.
    const first = dataRows(plain.hsnB2b!)[0]!;
    expect(first[8]).toBe("0.00"); // central tax
    expect(first[9]).toBe("0.00"); // state tax
    expect(first[10]).toBe("0.00"); // cess
  });

  it("keeps one readable description instead of a joined catalogue", () => {
    const description = String(dataRows(plain.hsnB2b!)[0]![1]);
    expect(description).not.toContain(";");
    expect(description.length).toBeLessThanOrEqual(60);
  });

  it("merges a 4-digit heading into its 6-digit form", () => {
    // Marketplace feeds spell the same commodity both ways; two rows for one
    // commodity is what put our Table 12 out of step with the CA's.
    const rows = dataRows(mixed.hsnB2b!);
    expect(rows).toHaveLength(1);
    expect(rows[0]![0]).toBe("441900");
    expect(Number(rows[0]![6])).toBeCloseTo(2000, 2);
  });

  it("drops a code that classifies nothing", () => {
    const codes = dataRows(mixed.hsnB2b!).map((r) => String(r[0]).trim());
    expect(codes).not.toContain("000000");
  });
});

describe("GSTR-1 workbook: documents issued (Table 13)", () => {
  let sheets: Record<string, Grid>;

  beforeAll(async () => {
    sheets = await build([
      row({ invoiceNumber: "IN-707" }),
      row({ invoiceNumber: "IN-1026" }),
      row({ invoiceNumber: "2026-2027/57" }),
      row({ invoiceNumber: "2026-2027/72" }),
      row({ invoiceNumber: "CN-78", invoiceType: "CDNR" }),
      row({ invoiceNumber: "CN-109", invoiceType: "CDNR" }),
      ...["00016573357568_1", "00561520991748_1", "01025225404736_1"].map((n) =>
        row({ invoiceNumber: n, invoiceType: "B2CS", buyerGstin: "" })
      ),
    ]);
  }, 180000);

  it("reports each invoice series on its own row", () => {
    // One row spanning "2026-2027/57 to IN-1026" describes no series that exists.
    const ranges = dataRows(sheets.docs!).map((r) => `${r[1]}→${r[2]} (${r[3]})`);

    expect(ranges).toContain("IN-707→IN-1026 (2)");
    expect(ranges).toContain("2026-2027/57→2026-2027/72 (2)");
  });

  it("folds marketplace order ids into one block", () => {
    // Each order id has a stem unique to itself, which would otherwise put a
    // thousand orders on a thousand rows.
    const orderBlock = dataRows(sheets.docs!).find((r) => String(r[1]).startsWith("000165"));

    expect(orderBlock, "order ids should share one row").toBeDefined();
    expect(Number(orderBlock![3])).toBe(3);
  });

  it("keeps credit notes separate from invoices, and lists invoices first", () => {
    const rows = dataRows(sheets.docs!);
    const creditNotes = rows.filter((r) => r[0] === "Credit Note");

    expect(creditNotes).toHaveLength(1);
    expect(`${creditNotes[0]![1]}→${creditNotes[0]![2]}`).toBe("CN-78→CN-109");
    expect(rows[0]![0]).toBe("Invoices for outward supply");
  });
});
