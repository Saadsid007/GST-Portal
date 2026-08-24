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
