import { describe, it, expect } from "vitest";
import { FlipkartAdapter } from "@/features/convert/engine/adapters/flipkart.adapter";
import { inheritCommodityByOrder } from "@/features/convert/engine/enrichment/order-reference";
import { buildDocumentSeries } from "@/features/convert/domain/document-series";

const context = {
  marketplace: "FLIPKART",
  sourceId: "flipkart_f",
  fileId: "f",
  fileName: "sales.xlsx",
  sourceRow: 0,
  reportType: "sales",
  supplierGstin: "09AGCPW4984F2ZT",
};

function sale(over: Record<string, string>) {
  return {
    "Seller GSTIN": "09AGCPW4984F2ZT",
    "Order ID": "OD1",
    "Order Item ID": "OI1",
    "HSN Code": "4421",
    "Event Type": "Sale",
    "Event Sub Type": "Sale",
    "Item Quantity": "1.0",
    "Taxable Value (Final Invoice Amount -Taxes)": "206.67",
    "IGST Rate": "5.0",
    "IGST Amount": "10.33",
    "Buyer Invoice ID": "LWAGDGQ270000001",
    "Buyer Invoice Date": "2026-08-19 00:00:00.0",
    "Customer's Delivery State": "Assam",
    ...over,
  };
}

function cashBack(documentType: string, id: string) {
  return {
    "Seller GSTIN": "09AGCPW4984F2ZT",
    "Order ID": "OD1",
    "Order Item ID": "OI1",
    "Document Type": documentType,
    "Document Sub Type": "Sale",
    "Credit Note ID/ Debit Note ID": id,
    "Invoice Amount": "19.0",
    "Invoice Date": "2026-08-19 00:00:00.0",
    "Taxable Value": "18.1",
    "IGST Rate": "5.0",
    "IGST Amount": "0.9",
    "Customer's Delivery State": "Assam",
  };
}

describe("Flipkart's monthly sales report", () => {
  it("puts a sale back when its return is cancelled", () => {
    // Filed under Event Type "Return" with the reversal only in the
    // sub-type, so reading the type alone subtracted the sale twice.
    const { transactions } = FlipkartAdapter.adapt(
      [
        sale({
          "Event Type": "Return",
          "Event Sub Type": "Return Cancellation",
          "Buyer Invoice ID": "LOADV7V270000001",
        }),
      ],
      { ...context, sheetName: "Sales Report" }
    );

    expect(transactions[0]!.taxableValue).toBeGreaterThan(0);
    expect(transactions[0]!.isDebitNote).toBe(true);
  });

  it("adds a cash back debit note and subtracts a credit note", () => {
    const { transactions } = FlipkartAdapter.adapt(
      [cashBack("Credit Note", "LYAFSAF270000001"), cashBack("Debit Note", "LZAFMJY270000001")],
      { ...context, sheetName: "Cash Back Report" }
    );

    expect(transactions[0]!.taxableValue).toBeLessThan(0);
    expect(transactions[1]!.taxableValue).toBeGreaterThan(0);
    // Money, not goods: no unit leaves Table 12.
    expect(transactions.every((t) => t.quantity === 0)).toBe(true);
  });

  it("gives a cash back note the commodity of its sale", () => {
    // The cash back sheet has no HSN column, so the notes fell out of
    // Table 12 while still counting in Table 7.
    const sales = FlipkartAdapter.adapt([sale({})], { ...context, sheetName: "Sales Report" });
    const notes = FlipkartAdapter.adapt([cashBack("Credit Note", "LYAFSAF270000001")], {
      ...context,
      sheetName: "Cash Back Report",
    });
    const rows = [...sales.transactions, ...notes.transactions];

    inheritCommodityByOrder(rows);

    expect(rows[1]!.hsnCode).toBe(rows[0]!.hsnCode);
  });

  it("counts a debit note under its own heading in Table 13", () => {
    const { transactions } = FlipkartAdapter.adapt(
      [cashBack("Debit Note", "LZAFMJY270000001"), cashBack("Debit Note", "LZAFMJY270000002")],
      { ...context, sheetName: "Cash Back Report" }
    );

    expect(buildDocumentSeries(transactions).map((s) => s.documentType)).toEqual(["Debit Note"]);
  });
});
