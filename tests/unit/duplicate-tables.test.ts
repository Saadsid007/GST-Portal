import { describe, it, expect } from "vitest";
import { detectDuplicateTables } from "@/features/convert/engine/detection/duplicate-tables";
import type { ReconstructedTable } from "@/features/convert/engine/universal/types";

function table(sheetName: string, rows: Record<string, string>[]): ReconstructedTable {
  return {
    sheetName,
    headers: Object.keys(rows[0] ?? { A: "" }),
    rows,
  } as ReconstructedTable;
}

const REGISTER = [
  { "Invoice Number": "2026-27/36", "Taxable Value": "9000" },
  { "Invoice Number": "2026-27/41", "Taxable Value": "9000" },
];

describe("a second copy of the same upload", () => {
  it("keeps the first and sets aside the copy in the other folder", () => {
    // A seller's folder held the register twice — once at the top and once in
    // a "New folder" — and every row counted twice, which read as a ₹56,000
    // tax difference rather than as a duplicate file.
    const duplicates = detectDuplicateTables([
      { fileName: "GSTR1_Invoice_Register_Aug2026.xlsx", table: table("B2C", REGISTER) },
      { fileName: "GSTR1_Invoice_Register_Aug2026.xlsx", table: table("B2C", REGISTER) },
    ]);

    expect([...duplicates.keys()]).toEqual([1]);
    expect(duplicates.get(1)!.rows).toBe(2);
  });

  it("recognises the copy through the mark Windows adds to its name", () => {
    const duplicates = detectDuplicateTables([
      { fileName: "register.xlsx", table: table("B2C", REGISTER) },
      { fileName: "register (1).xlsx", table: table("B2C", REGISTER) },
      { fileName: "register - Copy.xlsx", table: table("B2C", REGISTER) },
    ]);

    expect([...duplicates.keys()]).toEqual([1, 2]);
  });

  it("does not drop two different invoices that happen to read the same", () => {
    // An invoice printout carries its number in a merged heading, not in a
    // column, so two invoices for the same goods and quantity reduce to an
    // identical table. Dropping one would lose a real sale, so the file name
    // has to agree before anything is set aside.
    const line = [{ "Description of Goods": "LOBAN DAN SMALL", Qty: "600", Amount: "9000.00" }];
    const duplicates = detectDuplicateTables([
      { fileName: "26-27(36).xlsx", table: table("BILL NO. 10", line) },
      { fileName: "26-27(41).xlsx", table: table("BILL NO. 10", line) },
    ]);

    expect(duplicates.size).toBe(0);
  });

  it("does not call two different months of the same export a copy", () => {
    const duplicates = detectDuplicateTables([
      { fileName: "register.xlsx", table: table("B2C", REGISTER) },
      {
        fileName: "register.xlsx",
        table: table("B2C", [{ "Invoice Number": "2026-27/51", "Taxable Value": "9000" }]),
      },
    ]);

    expect(duplicates.size).toBe(0);
  });

  it("recognises the same invoices exported under a different name", () => {
    // A seller exported one set of PDFs twice — "GST_Extracted_Invoices" and
    // "B2B_Invoices_Summary" — and handed over both. The rows name the
    // documents they list, so the content settles it without the file names
    // having to agree.
    const duplicates = detectDuplicateTables([
      { fileName: "GST_Extracted_Invoices.xlsx", table: table("Sheet1", REGISTER) },
      { fileName: "B2B_Invoices_Summary.xlsx", table: table("Sheet1", REGISTER) },
    ]);

    expect([...duplicates.keys()]).toEqual([1]);
    expect(duplicates.get(1)!.reason).toContain("GST_Extracted_Invoices.xlsx");
  });

  it("leaves the empty tabs of a template alone", () => {
    const duplicates = detectDuplicateTables([
      { fileName: "template.xlsx", table: table("b2cl", []) },
      { fileName: "template.xlsx", table: table("exp", []) },
    ]);

    expect(duplicates.size).toBe(0);
  });
});
