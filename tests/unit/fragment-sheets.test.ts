import { describe, it, expect } from "vitest";
import { detectFragmentSheets } from "@/features/convert/engine/detection/fragment-sheets";
import type { ReconstructedTable } from "@/features/convert/engine/universal/types";

function table(sheetName: string, headers: string[]): ReconstructedTable {
  return {
    sheetName,
    headers,
    rows: [],
    headerRowIndex: 0,
    headerRowSpan: 1,
    discarded: [],
    score: 100,
  };
}

const MEESHO_EXPORT = [
  "identifier",
  "sup_name",
  "gstin",
  "sub_order_num",
  "order_date",
  "hsn_code",
  "quantity",
  "gst_rate",
  "total_taxable_sale_value",
  "tax_amount",
  "total_invoice_value",
  "taxable_shipping",
  "end_customer_state_new",
];

/**
 * Sellers pull a few columns onto a second tab to total them up, and the tab
 * travels with the file. Imported, it adds the turnover a second time.
 */
describe("a working copy of another sheet in the same workbook", () => {
  it("is caught even though its name says nothing", () => {
    // Real case: 655 orders on the export, the same rows reduced to four
    // columns on "Sheet2".
    const fragment = [
      "gst_rate",
      "total_taxable_sale_value",
      "tax_amount",
      "total_invoice_value",
      "taxable_shipping",
      "end_customer_state_new",
    ];

    const found = detectFragmentSheets([
      { fileName: "tcs_sales.xlsx", table: table("527510", MEESHO_EXPORT) },
      { fileName: "tcs_sales.xlsx", table: table("Sheet2", fragment) },
    ]);

    expect(found).toHaveLength(1);
    expect(found[0]!.sheetName).toBe("Sheet2");
    expect(found[0]!.copiedFrom).toBe("527510");
    expect(found[0]!.reason).toMatch(/count these supplies twice/i);
  });

  it("leaves the export itself alone", () => {
    const found = detectFragmentSheets([
      { fileName: "tcs_sales.xlsx", table: table("527510", MEESHO_EXPORT) },
      { fileName: "tcs_sales.xlsx", table: table("Sheet2", ["gst_rate", "tax_amount"]) },
    ]);

    expect(found.map((f) => f.sheetName)).toEqual(["Sheet2"]);
  });

  it("keeps a summary that stands on its own", () => {
    // Flipkart's Section 7(A)(2) is a rate-wise summary with no invoice
    // number either, and it is real data we report. What separates it from a
    // fragment is that its columns are not a subset of another sheet's.
    const section7a2 = [
      "GSTIN",
      "Gross Taxable Value Rs.",
      "Aggregate Taxable Value Rs.",
      "CGST %",
      "CGST Amount Rs.",
    ];

    const found = detectFragmentSheets([
      { fileName: "flipkart.xlsx", table: table("Section 5B in GSTR-1", MEESHO_EXPORT) },
      { fileName: "flipkart.xlsx", table: table("Section 7(A)(2) in GSTR-1", section7a2) },
    ]);

    expect(found).toHaveLength(0);
  });

  it("keeps a subset that can still identify its documents", () => {
    // A trimmed copy that kept the invoice number is a usable register, not a
    // fragment — it can be reconciled rather than double-counted blindly.
    const trimmed = ["sub_order_num", "gst_rate", "total_taxable_sale_value"];

    const found = detectFragmentSheets([
      { fileName: "tcs_sales.xlsx", table: table("527510", MEESHO_EXPORT) },
      { fileName: "tcs_sales.xlsx", table: table("Sheet2", trimmed) },
    ]);

    expect(found).toHaveLength(0);
  });

  it("does not compare sheets across different files", () => {
    // Two sellers' workbooks uploaded together are not copies of each other.
    const found = detectFragmentSheets([
      { fileName: "a.xlsx", table: table("527510", MEESHO_EXPORT) },
      { fileName: "b.xlsx", table: table("Sheet1", ["gst_rate", "tax_amount"]) },
    ]);

    expect(found).toHaveLength(0);
  });

  it("does nothing to a single-sheet workbook", () => {
    const found = detectFragmentSheets([
      { fileName: "tcs_sales.xlsx", table: table("527510", ["gst_rate", "tax_amount"]) },
    ]);

    expect(found).toHaveLength(0);
  });
});
