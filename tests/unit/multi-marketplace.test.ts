import { describe, it, expect } from "vitest";
import { ImportSessionManager } from "@/features/convert/engine/pipeline/import-session.manager";
import type { ReconstructedTable } from "@/features/convert/engine/universal/types";

describe("Multi-Marketplace Isolation & Order Independence", () => {
  const amazonTable: ReconstructedTable = {
    sheetName: "Amazon B2B",
    headers: [
      "Invoice Number",
      "Invoice Date",
      "Transaction Type",
      "Buyer Gstin",
      "Customer Bill To State",
      "Tax Exclusive Gross",
      "Total Tax Amount",
    ],
    rows: [
      {
        "Invoice Number": "AMZ-001",
        "Invoice Date": "2024-05-01",
        "Transaction Type": "Shipment",
        "Buyer Gstin": "27XXXXXAMZ1Z5",
        "Customer Bill To State": "MH",
        "Tax Exclusive Gross": "1000",
        "Total Tax Amount": "180",
      },
    ],
    headerRowIndex: 0,
    headerRowSpan: 1,
    discarded: [],
    score: 100,
  };

  const meeshoTable: ReconstructedTable = {
    sheetName: "Meesho Sales Report",
    headers: [
      "Invoice Number",
      "Invoice Date",
      "Record Type",
      "Customer GSTIN",
      "End Customer State",
      "Sub Order No",
      "Taxable Amount",
      "GST Rate",
      "IGST Amount",
      "Total Amount",
    ],
    rows: [
      {
        "Invoice Number": "MSH-002",
        "Invoice Date": "2024-05-02",
        "Record Type": "Sale",
        "Customer GSTIN": "29XXXXXMSH1Z5",
        "End Customer State": "KA",
        "Sub Order No": "SUB-999",
        "Taxable Amount": "2000",
        "GST Rate": "18",
        "IGST Amount": "360",
        "Total Amount": "2360",
      },
    ],
    headerRowIndex: 0,
    headerRowSpan: 1,
    discarded: [],
    score: 100,
  };

  it("should process files into isolated adapters based on detection", async () => {
    const result = await ImportSessionManager.processBatch([
      { fileId: "file1", fileName: "Amazon MTR.xlsx", table: amazonTable },
      { fileId: "file2", fileName: "Meesho GST.xlsx", table: meeshoTable },
    ]);

    expect(result.filesProcessed).toBe(2);
    expect(result.resultsByPlatform.amazon).toBeDefined();
    expect(result.resultsByPlatform.meesho).toBeDefined();

    expect(result.resultsByPlatform.amazon?.validRows).toBe(1);
    expect(result.resultsByPlatform.meesho?.validRows).toBe(1);

    const amazonTx = result.resultsByPlatform.amazon!.transactions[0];
    const meeshoTx = result.resultsByPlatform.meesho!.transactions[0];

    expect(amazonTx?.invoiceNumber).toBe("AMZ-001");
    expect(meeshoTx?.invoiceNumber).toBe("MSH-002");
  });

  it("must produce identical results regardless of upload order (Order Independence)", async () => {
    const resultOrder1 = await ImportSessionManager.processBatch([
      { fileId: "f1", fileName: "Amazon MTR.xlsx", table: amazonTable },
      { fileId: "f2", fileName: "Meesho GST.xlsx", table: meeshoTable },
    ]);

    const resultOrder2 = await ImportSessionManager.processBatch([
      { fileId: "f2", fileName: "Meesho GST.xlsx", table: meeshoTable },
      { fileId: "f1", fileName: "Amazon MTR.xlsx", table: amazonTable },
    ]);

    // Strip IDs from transactions to compare business equality
    const clean1 = resultOrder1.combinedTransactions.map((t) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, rowIndex, ...rest } = t;
      return rest;
    });

    const clean2 = resultOrder2.combinedTransactions.map((t) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, rowIndex, ...rest } = t;
      return rest;
    });

    // They should have exactly the same set of rows, possibly in different order
    const sorted1 = clean1.sort((a, b) => a.invoiceNumber!.localeCompare(b.invoiceNumber!));
    const sorted2 = clean2.sort((a, b) => a.invoiceNumber!.localeCompare(b.invoiceNumber!));

    expect(sorted1).toEqual(sorted2);
  });
});
