import { describe, it, expect } from "vitest";
import { classifyCompanionSheet } from "@/features/convert/engine/detection/companion-sheets";

/**
 * These sheets used to reach the AI mapper, which then asked the user to pick an
 * invoice number out of "HSN Number" or "Total Number of Invoices" — questions
 * with no correct answer, because the sheet holds no invoices.
 */
describe("classifyCompanionSheet", () => {
  it("skips the sheets Flipkart's GSTR workbook ships alongside the data", () => {
    for (const sheet of [
      "Help",
      "Section 12 in GSTR-1",
      "Section 13 in GSTR-1",
      "Section 3 in GSTR-8",
      "Section 10A(1) in GSTR-1",
      "Section 10B(1) in GSTR-1",
    ]) {
      expect(classifyCompanionSheet(sheet), `${sheet} should be skipped`).not.toBeNull();
    }
  });

  it("lets every transactional section through", () => {
    // 5B is B2B/B2CL invoices; 7(A)(2) and 7(B)(2) are intra- and interstate B2CS.
    for (const sheet of [
      "Section 5B in GSTR-1",
      "Section 7(A)(2) in GSTR-1",
      "Section 7(B)(2) in GSTR-1",
    ]) {
      expect(classifyCompanionSheet(sheet), `${sheet} must be imported`).toBeNull();
    }
  });

  it("does not swallow ordinary marketplace sheets", () => {
    for (const sheet of ["Sheet1", "MTR B2B", "tcs_sales", "Sales Report", "Order Details"]) {
      expect(classifyCompanionSheet(sheet)).toBeNull();
    }
  });

  it("explains why a sheet was skipped rather than just dropping it", () => {
    expect(classifyCompanionSheet("Section 12 in GSTR-1")?.reason).toMatch(/HSN/i);
    expect(classifyCompanionSheet("Section 3 in GSTR-8")?.reason).toMatch(/TCS/i);
    expect(classifyCompanionSheet("Help")?.reason).toMatch(/instruction/i);
  });

  it("tolerates naming variants and blank names", () => {
    expect(classifyCompanionSheet("  SECTION 12  ")).not.toBeNull();
    expect(classifyCompanionSheet("Section 3 in GSTR 8")).not.toBeNull();
    expect(classifyCompanionSheet("")).toBeNull();
  });
});

/**
 * Accountants save a pivot next to the raw export, and it travels with the file
 * on upload. Read as line items it adds the seller's whole turnover a second
 * time — its rows are states, not supplies.
 */
describe("Excel PivotTables saved alongside the data", () => {
  it("turns away a state-wise pivot whatever the sheet is called", () => {
    // Both of these are real: one tab is named "MESHOO", the other "Sheet1",
    // and each sits in the same workbook as a genuine Meesho export.
    const headers = ["Row Labels", "5.00", "MESHOO", "Grand Total"];

    expect(classifyCompanionSheet("MESHOO", headers)).not.toBeNull();
    expect(classifyCompanionSheet("Sheet1", headers)).not.toBeNull();
  });

  it("tells the user what to upload instead", () => {
    const reason = classifyCompanionSheet("Sheet1", ["Row Labels", "18.00", "Grand Total"])?.reason;

    expect(reason).toMatch(/pivot/i);
    expect(reason).toMatch(/original rows/i);
  });

  it("catches the pivot by the header row a reconstructor actually picks", () => {
    // "Row Labels" and "Sum of …" sit on different rows of the same pivot, and
    // the reconstructor settles on the upper one — so relying on "Row Labels"
    // alone let every real pivot through.
    const asRead = ["Sum of total_taxable_sale_value", "Column Labels", "Column 3", "Column 4"];

    expect(classifyCompanionSheet("MESHOO", asRead)).not.toBeNull();
  });

  it("keeps a register that merely ends in a total row", () => {
    // One marker is not enough: hand-kept invoice registers legitimately carry
    // a "Grand Total", and rejecting those would throw away real invoices.
    const register = ["Invoice Number", "Customer State", "Taxable Amount", "Grand Total"];

    expect(classifyCompanionSheet("Invoice Report", register)).toBeNull();
  });

  it("still admits the real export in the same workbook", () => {
    const meesho = ["identifier", "sup_name", "gstin", "sub_order_num", "hsn_code"];

    expect(classifyCompanionSheet("106197", meesho)).toBeNull();
  });
});
