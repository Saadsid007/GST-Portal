import { describe, it, expect } from "vitest";
import { readWorkbook } from "@/features/convert/engine/universal/universal-import.engine";
import { ImportSessionManager } from "@/features/convert/engine/pipeline/import-session.manager";
import { validateInvoices } from "@/features/convert/domain/validator";
import * as fs from "fs";
import * as path from "path";

describe("Real User Sample Files Validation", () => {
  it("should parse Amazon B2B & B2C without CGST/IGST tax mismatches", async () => {
    const b2bPath = path.resolve(
      __dirname,
      "../../Sample/New/MTR_B2B-JULY-2026-A2AHFNUOL9RNV9.csv"
    );
    const b2cPath = path.resolve(
      __dirname,
      "../../Sample/New/MTR_B2C-JULY-2026-A2AHFNUOL9RNV9.csv"
    );

    const b2bBuf = fs.readFileSync(b2bPath);
    const b2cBuf = fs.readFileSync(b2cPath);

    const b2bTable = readWorkbook(b2bBuf)[0]!;
    const b2cTable = readWorkbook(b2cBuf)[0]!;

    const result = await ImportSessionManager.processBatch([
      { fileId: "b2b", fileName: "MTR_B2B-JULY-2026.csv", table: b2bTable },
      { fileId: "b2c", fileName: "MTR_B2C-JULY-2026.csv", table: b2cTable },
    ]);

    expect(result.resultsByPlatform.amazon).toBeDefined();
    const amazonResult = result.resultsByPlatform.amazon!;

    // Check validation output for supplier GSTIN 09BHCPS1644C1ZI
    const validation = validateInvoices(amazonResult.transactions, "09BHCPS1644C1ZI");

    // Tax mismatch errors should be 0
    const taxMismatchIssues = validation.issues.filter(
      (i) => i.message && i.message.includes("mismatch")
    );
    expect(taxMismatchIssues.length).toBe(0);
  });

  it("should parse Meesho TCS Sales & Return without missing Place of Supply", async () => {
    const salesPath = path.resolve(__dirname, "../../Sample/New/Meesho/tcs_sales.xlsx");
    const returnPath = path.resolve(__dirname, "../../Sample/New/Meesho/tcs_sales_return.xlsx");

    const salesBuf = fs.readFileSync(salesPath);
    const returnBuf = fs.readFileSync(returnPath);

    const salesTable = readWorkbook(salesBuf)[0]!;
    const returnTable = readWorkbook(returnBuf)[0]!;

    const result = await ImportSessionManager.processBatch([
      { fileId: "meesho_sales", fileName: "tcs_sales.xlsx", table: salesTable },
      { fileId: "meesho_returns", fileName: "tcs_sales_return.xlsx", table: returnTable },
    ]);

    expect(result.resultsByPlatform.meesho).toBeDefined();
    const meeshoResult = result.resultsByPlatform.meesho!;

    // Place of supply errors should be 0
    const posMissing = meeshoResult.transactions.filter((t) => !t.placeOfSupply);
    expect(posMissing.length).toBe(0);
  });
});
