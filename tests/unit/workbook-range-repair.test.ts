import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { repairSheetRange } from "@/features/convert/utils/workbook.utils";

/**
 * A worksheet whose declared `!ref` disagrees with its cells is the quietest
 * failure in the import path: nothing throws, the file simply parses as fewer
 * rows than it has. These pin the repair to widening only.
 */
function sheetWith(cells: Record<string, string | number>, ref: string): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = { "!ref": ref };
  for (const [addr, v] of Object.entries(cells)) {
    ws[addr] = { t: typeof v === "number" ? "n" : "s", v };
  }
  return ws;
}

describe("repairSheetRange", () => {
  it("widens a range that hides data rows", () => {
    // Exactly the Flipkart defect: one declared row, two real ones.
    const ws = sheetWith(
      { A1: "GSTIN", B1: "Taxable", A2: "09FLRPK4935D1ZO", B2: 966.1 },
      "A1:IV1"
    );

    expect(XLSX.utils.sheet_to_json(ws)).toHaveLength(0);
    expect(repairSheetRange(ws)).toBe(true);
    expect(ws["!ref"]).toBe("A1:B2");
    expect(XLSX.utils.sheet_to_json(ws)).toHaveLength(1);
  });

  it("narrows a range padded with hundreds of phantom columns", () => {
    // IV is column 255; leaving it makes header detection scan empty columns.
    const ws = sheetWith({ A1: "GSTIN", B1: "Taxable" }, "A1:IV1");
    expect(repairSheetRange(ws)).toBe(true);
    expect(ws["!ref"]).toBe("A1:B1");
  });

  it("leaves a correct range untouched", () => {
    const ws = sheetWith({ A1: "GSTIN", B1: "Taxable", A2: "27AAA", B2: 10 }, "A1:B2");
    expect(repairSheetRange(ws)).toBe(false);
    expect(ws["!ref"]).toBe("A1:B2");
  });

  it("never shrinks the row span a declared range claims", () => {
    // Trailing blank rows are left alone; only the phantom column padding goes.
    const ws = sheetWith({ A1: "GSTIN", A2: "27AAA" }, "A1:D10");
    repairSheetRange(ws);
    expect(ws["!ref"]).toBe("A1:A10");
  });

  it("handles an empty sheet without inventing a range", () => {
    const ws: XLSX.WorkSheet = { "!ref": "A1:IV1" };
    expect(repairSheetRange(ws)).toBe(false);
  });

  it("ignores non-cell keys when computing bounds", () => {
    const ws = sheetWith({ A1: "GSTIN", A2: "27AAA" }, "A1:IV1");
    ws["!merges"] = [];
    ws["!cols"] = [];
    expect(repairSheetRange(ws)).toBe(true);
    expect(ws["!ref"]).toBe("A1:A2");
  });
});
