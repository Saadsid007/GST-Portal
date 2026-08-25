import { describe, it, expect } from "vitest";
import {
  toComparableRow,
  Gstr1Comparator,
} from "@/features/convert/engine/comparison/gstr1.comparator";
import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";
import type { ParsedGstr1Template } from "@/features/convert/engine/comparison/gstr1-template.parser";

/**
 * The comparison runs as a Server Action, so every field on every row is
 * serialised and uploaded alongside the reference workbook. A month of invoices
 * is thousands of rows; sending the parts the comparison never reads is what
 * pushed the request past a proxy limit in production while staying under it in
 * development.
 */
function fullRow(overrides: Partial<NormalizedInvoiceRow> = {}): NormalizedInvoiceRow {
  return {
    id: crypto.randomUUID(),
    rowIndex: 1,
    sourcePlatformId: "amazon",
    sourcePlatformName: "Amazon",
    sourceFileName: "MTR_B2B-JULY-2026-A2AHFNUOL9RNV9.csv",
    sourceFileType: "b2b",
    transactionType: "Sales",
    invoiceNumber: "BLR7-T-7",
    invoiceDate: "2026-07-01",
    invoiceType: "B2B",
    buyerName: "Some Registered Buyer Private Limited",
    buyerGstin: "06AADCV4254H1ZC",
    placeOfSupply: "06",
    hsnCode: "441900",
    itemDescription:
      "Wood Art Store Tray Home Decor, Round Wood Tray for Coffee Table, Wooden Serving Tray, Decorative Trays for Home Decor",
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
    ecoGstin: "09AACCF0683K1ZF",
    ecoName: "Flipkart Internet Private Limited",
    errors: [],
    reviews: ["Rate inferred from HSN"],
    ...overrides,
  } as NormalizedInvoiceRow;
}

describe("comparison payload", () => {
  it("carries only the fields the comparison reads", () => {
    const slim = toComparableRow(fullRow());

    expect(Object.keys(slim).sort()).toEqual(
      [
        "buyerGstin",
        "cessAmount",
        "cgstAmount",
        "cgstRate",
        "errors",
        "igstAmount",
        "igstRate",
        "invoiceNumber",
        "invoiceType",
        "placeOfSupply",
        "sgstAmount",
        "sgstRate",
        "taxableValue",
        "totalValue",
        "transactionType",
      ].sort()
    );

    // Nothing descriptive travels: these are the bulk of a row's bytes.
    const asText = JSON.stringify(slim);
    expect(asText).not.toContain("Wood Art Store");
    expect(asText).not.toContain("MTR_B2B");
    expect(asText).not.toContain("Flipkart Internet");
  });

  it("meaningfully shrinks the request", () => {
    const rows = Array.from({ length: 2879 }, () => fullRow());
    const before = JSON.stringify(rows).length;
    const after = JSON.stringify(rows.map(toComparableRow)).length;

    // A real month: ~2,879 rows. The exact ratio does not matter, but a request
    // that is no smaller means the projection has stopped doing its job.
    expect(after).toBeLessThan(before * 0.5);
  });

  it("compares identically whether given full or narrowed rows", () => {
    const rows = [
      fullRow(),
      fullRow({ invoiceNumber: "BLR7-T-8", taxableValue: 1000, igstAmount: 50, totalValue: 1050 }),
    ];
    const emptyRef: ParsedGstr1Template = {
      sourceType: "govt_template",
      b2b: [],
      b2cs: [],
      b2cl: [],
      cdnr: [],
      cdnur: [],
    };

    const fromFull = Gstr1Comparator.compare(rows, emptyRef);
    const fromSlim = Gstr1Comparator.compare(rows.map(toComparableRow), emptyRef);

    expect(fromSlim.totalOurInvoices).toBe(fromFull.totalOurInvoices);
    expect(fromSlim.b2csTotalOur).toBe(fromFull.b2csTotalOur);
    expect(fromSlim.onlyInOursCount).toBe(fromFull.onlyInOursCount);
    expect(fromSlim.b2bRows.length).toBe(fromFull.b2bRows.length);
  });
});
