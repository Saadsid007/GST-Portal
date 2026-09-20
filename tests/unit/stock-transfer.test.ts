import { describe, it, expect } from "vitest";
import {
  isStockTransferRow,
  excludeStockTransfers,
  summariseStockTransfers,
} from "@/features/convert/domain/stock-transfer";
import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";

const SELLER = "09KLJPS4652C1ZN";

function row(over: Partial<NormalizedInvoiceRow> = {}): NormalizedInvoiceRow {
  return {
    id: crypto.randomUUID(),
    rowIndex: 0,
    transactionType: "Sales",
    invoiceNumber: "IN-1",
    invoiceDate: "2026-08-01",
    invoiceType: "B2B",
    buyerName: "Customer",
    buyerGstin: "06AARPM2103R1ZB",
    placeOfSupply: "06",
    hsnCode: "441900",
    itemDescription: "Wooden tray",
    uqc: "PCS",
    quantity: 1,
    taxableValue: 1000,
    igstRate: 5,
    cgstRate: 0,
    sgstRate: 0,
    cessRate: 0,
    igstAmount: 50,
    cgstAmount: 0,
    sgstAmount: 0,
    cessAmount: 0,
    totalValue: 1050,
    errors: [],
    ...over,
  } as NormalizedInvoiceRow;
}

describe("recognising a movement of the seller's own stock", () => {
  it("catches a document to another registration of the same PAN", () => {
    // A delivery challan extracted from a PDF arrives typed B2B with the
    // seller's Haryana branch as the buyer. Only the PAN test catches it, and
    // the Excel generator did not have that test — so it declared the branch
    // transfer as a sale while the JSON of the same return left it out.
    expect(isStockTransferRow(row({ buyerGstin: "06KLJPS4652C1ZT" }), SELLER)).toBe(true);
  });

  it("leaves a genuine sale to an outside business alone", () => {
    expect(isStockTransferRow(row({ buyerGstin: "06AARPM2103R1ZB" }), SELLER)).toBe(false);
  });

  it("catches the marketplace transfer feeds by platform, file and series", () => {
    expect(isStockTransferRow(row({ sourcePlatformId: "amazon_stock_transfer" }), SELLER)).toBe(
      true
    );
    expect(
      isStockTransferRow(row({ sourceFileName: "MTR_STOCK_TRANSFER-AUGUST-2026.csv" }), SELLER)
    ).toBe(true);
    expect(isStockTransferRow(row({ invoiceNumber: "LKO1-T-9" }), SELLER)).toBe(true);
    expect(isStockTransferRow(row({ invoiceNumber: "AFT-4471" }), SELLER)).toBe(true);
  });

  it("does not call a row a transfer just because the buyer is unregistered", () => {
    // Both PANs empty must not compare equal, or every B2C row in the return
    // would be held back as a transfer.
    expect(isStockTransferRow(row({ buyerGstin: "", invoiceType: "B2CS" }), SELLER)).toBe(false);
    expect(isStockTransferRow(row({ buyerGstin: "" }), "")).toBe(false);
  });

  it("reports what it held back", () => {
    const rows = [
      row({ buyerGstin: "06KLJPS4652C1ZT", taxableValue: 18714.29 }),
      row({ buyerGstin: "06AARPM2103R1ZB", taxableValue: 1000 }),
    ];

    expect(excludeStockTransfers(rows, SELLER)).toHaveLength(1);
    expect(summariseStockTransfers(rows, SELLER)).toEqual({ rows: 1, taxableValue: 18714.29 });
  });
});
