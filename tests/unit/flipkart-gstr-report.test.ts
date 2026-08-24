import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { readWorkbook } from "@/features/convert/engine/universal/universal-import.engine";
import { ImportSessionManager } from "@/features/convert/engine/pipeline/import-session.manager";

/**
 * Flipkart's "Report for GSTR-1 and GSTR-8 Return Filing" — the section-wise
 * workbook, not the order-line export.
 *
 * The real sample this covers declares `!ref` as `A1:IV1` on every sheet: one
 * row tall, so every data row is invisible to `sheet_to_json`, and 256 columns
 * wide. Uploading it used to yield "no rows found" rather than the single
 * interstate B2CS sale it actually contains.
 */
const SAMPLE = path.resolve(
  __dirname,
  "../../Sample/new 18/4b4cad89-1016-4da0-aaea-2b2476a67e5f_1787558363000.xlsx"
);

describe("Flipkart GSTR-1/GSTR-8 section report", () => {
  it("recovers the data rows a broken sheet range hides", () => {
    const tables = readWorkbook(fs.readFileSync(SAMPLE));

    const section7B2 = tables.find((t) => t.sheetName.includes("7(B)(2)"));
    expect(section7B2, "Section 7(B)(2) sheet should be reconstructed").toBeDefined();
    // Without the range repair this is 0 — the header parses, the data does not.
    expect(section7B2!.rows.length).toBeGreaterThan(0);
  });

  it("imports the interstate B2CS sale with its tax intact", async () => {
    const tables = readWorkbook(fs.readFileSync(SAMPLE));

    const batch = tables
      .filter((t) => t.rows.length > 0)
      .map((table, i) => ({
        fileId: `fk-${i}`,
        fileName: "flipkart-gstr-report.xlsx",
        table,
      }));

    const result = await ImportSessionManager.processBatch(batch);
    const flipkart = result.resultsByPlatform.flipkart;

    expect(flipkart, "file should be recognised as Flipkart").toBeDefined();
    expect(flipkart!.transactions.length).toBeGreaterThan(0);

    const sale = flipkart!.transactions.find((t) => t.taxableValue > 0)!;
    expect(sale).toBeDefined();
    expect(sale.taxableValue).toBeCloseTo(966.1, 2);
    expect(sale.igstAmount).toBeCloseTo(173.9, 2);
    // Interstate: IGST only, no CGST/SGST split.
    expect(sale.cgstAmount).toBe(0);
    expect(sale.sgstAmount).toBe(0);
    expect(sale.invoiceType).toBe("B2CS");
    expect(sale.placeOfSupply).toContain("23");
  });

  it("carries the Flipkart operator GSTIN for Table 14", async () => {
    const tables = readWorkbook(fs.readFileSync(SAMPLE));
    const batch = tables
      .filter((t) => t.rows.length > 0)
      .map((table, i) => ({ fileId: `fk-${i}`, fileName: "flipkart.xlsx", table }));

    const result = await ImportSessionManager.processBatch(batch);
    const sale = result.resultsByPlatform.flipkart?.transactions.find((t) => t.taxableValue > 0);

    expect(sale?.ecoGstin).toBeTruthy();
  });
});

describe("Flipkart companion sheets", () => {
  it("skips the summary sheets instead of asking the AI to map them", async () => {
    const tables = readWorkbook(fs.readFileSync(SAMPLE));
    const batch = tables.map((table, i) => ({
      fileId: `fk-${i}`,
      fileName: "flipkart-gstr-report.xlsx",
      table,
    }));

    const result = await ImportSessionManager.processBatch(batch);

    const skipped = result.skippedSheets.map((s) => s.sheetName);
    expect(skipped).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Help"),
        expect.stringContaining("Section 12"),
        expect.stringContaining("Section 13"),
        expect.stringContaining("GSTR-8"),
      ])
    );

    // The whole point: none of them should land in the AI-mapping bucket.
    const unmapped = result.unmappedFiles.map((t) => t.sheetName);
    expect(unmapped).not.toEqual(expect.arrayContaining([expect.stringContaining("Section 12")]));
    expect(unmapped).not.toEqual(expect.arrayContaining([expect.stringContaining("Section 13")]));
    expect(unmapped).not.toEqual(expect.arrayContaining([expect.stringContaining("Help")]));

    // And the real sale still imports.
    expect(result.resultsByPlatform.flipkart?.transactions.length).toBeGreaterThan(0);
  });
});
