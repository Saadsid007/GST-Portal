import { describe, expect, it } from "vitest";

import { mergeTransactions, type ParsedFileBatch } from "@/features/convert/engine/merge.engine";
import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";

function row(over: Partial<NormalizedInvoiceRow>): NormalizedInvoiceRow {
  return {
    id: "r",
    rowIndex: 1,
    invoiceNumber: "ORD-1",
    invoiceDate: "2026-05-01",
    invoiceType: "B2CS",
    buyerName: "Customer",
    buyerGstin: "",
    placeOfSupply: "27",
    hsnCode: "610910",
    quantity: 1,
    taxableValue: 1000,
    cgstRate: 9,
    sgstRate: 9,
    igstRate: 0,
    cessRate: 0,
    cgstAmount: 90,
    sgstAmount: 90,
    igstAmount: 0,
    cessAmount: 0,
    totalValue: 1180,
    transactionType: "Sales",
    errors: [],
    ...over,
  };
}

function batch(platformId: string, name: string, rows: NormalizedInvoiceRow[]): ParsedFileBatch {
  return {
    platformId,
    platformName: name,
    fileName: `${platformId}.xlsx`,
    fileTypeId: "sales",
    rows,
  };
}

describe("return source mapping", () => {
  it("attributes a return to the marketplace of its original invoice, not the file it arrived in", () => {
    const merged = mergeTransactions([
      batch("amazon", "Amazon", [row({ invoiceNumber: "AMZ-77" })]),
      batch("meesho", "Meesho", [
        row({
          invoiceNumber: "RET-1",
          originalInvoiceNumber: "AMZ-77",
          transactionType: "Return",
          taxableValue: -1000,
          cgstAmount: -90,
          sgstAmount: -90,
          totalValue: -1180,
        }),
      ]),
    ]);

    const ret = merged.mergedRows.find((r) => r.transactionType === "Return");
    expect(ret?.sourcePlatformId).toBe("amazon");
    expect(ret?.sourcePlatformName).toBe("Amazon");
  });

  it("leaves an ambiguous return alone rather than moving value to a guessed marketplace", () => {
    // The same order number exists on two other platforms — neither is the return's own,
    // so linking either way would silently reassign taxable value.
    const merged = mergeTransactions([
      batch("amazon", "Amazon", [row({ invoiceNumber: "SHARED-1" })]),
      batch("meesho", "Meesho", [row({ invoiceNumber: "SHARED-1" })]),
      batch("flipkart", "Flipkart", [
        row({
          invoiceNumber: "RET-1",
          originalInvoiceNumber: "SHARED-1",
          transactionType: "Return",
          taxableValue: -1000,
          cgstAmount: -90,
          sgstAmount: -90,
          totalValue: -1180,
        }),
      ]),
    ]);

    const ret = merged.mergedRows.find((r) => r.transactionType === "Return");
    expect(ret?.sourcePlatformId).toBe("flipkart");
  });

  it("prefers a same-platform sale when the order number is not unique", () => {
    const merged = mergeTransactions([
      batch("amazon", "Amazon", [row({ invoiceNumber: "SHARED-2", buyerName: "Amazon Buyer" })]),
      batch("meesho", "Meesho", [
        row({ invoiceNumber: "SHARED-2", buyerName: "Meesho Buyer" }),
        row({
          invoiceNumber: "RET-1",
          originalInvoiceNumber: "SHARED-2",
          buyerName: "",
          transactionType: "Return",
          taxableValue: -1000,
          cgstAmount: -90,
          sgstAmount: -90,
          totalValue: -1180,
        }),
      ]),
    ]);

    const ret = merged.mergedRows.find((r) => r.transactionType === "Return");
    expect(ret?.sourcePlatformId).toBe("meesho");
    expect(ret?.buyerName).toBe("Meesho Buyer");
  });
});
