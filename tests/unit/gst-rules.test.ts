import { describe, it, expect } from "vitest";
import {
  b2clThreshold,
  classifyB2cByInvoiceValue,
  isCdnurNote,
} from "@/features/convert/domain/gst-rules";
import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";

/** Supplier in UP (09), so a POS of 06 is inter-state and 09 is intra-state. */
const SUPPLIER = "09BHCPS1644C1ZI";

function row(over: Partial<NormalizedInvoiceRow>): NormalizedInvoiceRow {
  return {
    id: crypto.randomUUID(),
    rowIndex: 0,
    sourcePlatformId: "amazon",
    sourcePlatformName: "Amazon",
    sourceFileName: "mtr.csv",
    sourceFileType: "b2c",
    transactionType: "Sales",
    invoiceNumber: "IN-707",
    invoiceDate: "2026-07-01",
    invoiceType: "B2CS",
    buyerName: "Consumer",
    buyerGstin: "",
    placeOfSupply: "06",
    hsnCode: "441900",
    itemDescription: "Wooden tray",
    uqc: "NOS",
    quantity: 1,
    taxableValue: 1000,
    igstRate: 18,
    cgstRate: 0,
    sgstRate: 0,
    cessRate: 0,
    igstAmount: 180,
    cgstAmount: 0,
    sgstAmount: 0,
    cessAmount: 0,
    totalValue: 1180,
    errors: [],
    ...over,
  } as NormalizedInvoiceRow;
}

const typesOf = (rows: NormalizedInvoiceRow[]) => rows.map((r) => r.invoiceType);

describe("B2CL threshold follows the rule in force on the invoice date", () => {
  it("applies ₹1 lakh from 1 August 2024", () => {
    expect(b2clThreshold("2024-08-01")).toBe(100_000);
    expect(b2clThreshold("2026-07-15")).toBe(100_000);
  });

  it("keeps ₹2.5 lakh for documents dated before the amendment", () => {
    // A return or amendment for an earlier period is filed under the rule of
    // its day; applying today's limit would misreport it.
    expect(b2clThreshold("2024-07-31")).toBe(250_000);
    expect(b2clThreshold("2023-01-10")).toBe(250_000);
  });

  it("falls back to the current rule when the date cannot be read", () => {
    // The lower limit would promote small supplies into Table 5 on bad input.
    expect(b2clThreshold("not-a-date")).toBe(100_000);
  });
});

describe("B2CS vs B2CL is decided per invoice, not per line", () => {
  it("promotes an invoice whose lines only cross the limit together", () => {
    // A ₹1.5L invoice arriving as three ₹50k line items used to stay B2CS on
    // every row, so the invoice-wise reporting Rule 59(4) requires never
    // happened — and nothing in the output showed it had been skipped.
    const lines = [1, 2, 3].map(() =>
      row({ invoiceNumber: "INV-9001", taxableValue: 42_373, totalValue: 50_000 })
    );

    expect(typesOf(classifyB2cByInvoiceValue(lines, SUPPLIER))).toEqual(["B2CL", "B2CL", "B2CL"]);
  });

  it("leaves an invoice below the limit in B2CS", () => {
    const lines = [
      row({ invoiceNumber: "INV-9002", totalValue: 40_000 }),
      row({ invoiceNumber: "INV-9002", totalValue: 50_000 }),
    ];

    expect(typesOf(classifyB2cByInvoiceValue(lines, SUPPLIER))).toEqual(["B2CS", "B2CS"]);
  });

  it("measures the invoice value, not the taxable value", () => {
    // ₹95,000 taxable at 18% is a ₹1,12,100 invoice. Rule 59(4) measures what
    // the recipient pays, so this is B2CL even though the taxable value is not.
    const line = row({
      invoiceNumber: "INV-9003",
      taxableValue: 95_000,
      igstAmount: 17_100,
      totalValue: 112_100,
    });

    expect(typesOf(classifyB2cByInvoiceValue([line], SUPPLIER))).toEqual(["B2CL"]);
  });

  it("keeps an intra-state supply in B2CS however large", () => {
    // Table 5 is inter-state only.
    const line = row({
      invoiceNumber: "INV-9004",
      placeOfSupply: "09",
      igstRate: 0,
      cgstRate: 9,
      sgstRate: 9,
      totalValue: 500_000,
    });

    expect(typesOf(classifyB2cByInvoiceValue([line], SUPPLIER))).toEqual(["B2CS"]);
  });

  it("does not touch B2B, exports or credit notes", () => {
    const untouched = [
      row({ invoiceType: "B2B", buyerGstin: "06AADCV4254H1ZC", totalValue: 500_000 }),
      row({ invoiceType: "EXP", totalValue: 500_000 }),
      row({ invoiceType: "CDNR", transactionType: "Return", totalValue: -500_000 }),
    ];

    expect(typesOf(classifyB2cByInvoiceValue(untouched, SUPPLIER))).toEqual(["B2B", "EXP", "CDNR"]);
  });

  it("demotes a row wrongly marked B2CL", () => {
    // The pass is the single authority on this call, in both directions.
    const line = row({ invoiceType: "B2CL", invoiceNumber: "INV-9005", totalValue: 1_180 });

    expect(typesOf(classifyB2cByInvoiceValue([line], SUPPLIER))).toEqual(["B2CS"]);
  });

  it("leaves rows alone when the supplier GSTIN is unknown", () => {
    // Without the supplier state there is no way to tell inter- from
    // intra-state, and guessing would file real supplies in the wrong table.
    const line = row({ invoiceNumber: "INV-9006", totalValue: 500_000 });

    expect(typesOf(classifyB2cByInvoiceValue([line], undefined))).toEqual(["B2CS"]);
  });
});

describe("credit notes to unregistered recipients", () => {
  it("routes a large note to CDNUR even though its value is negative", () => {
    // The Excel generator compared `totalValue > 250000` on a negative number,
    // so no credit note ever reached Table 9B.
    const note = row({
      invoiceType: "CDNCS",
      transactionType: "Return",
      totalValue: -150_000,
      invoiceDate: "2026-07-01",
    });

    expect(isCdnurNote(note)).toBe(true);
  });

  it("nets a small note inside Table 7 instead", () => {
    expect(isCdnurNote(row({ invoiceType: "CDNCS", totalValue: -5_000 }))).toBe(false);
  });

  it("uses the threshold in force on the note date", () => {
    const value = { invoiceType: "CDNCS" as const, totalValue: -150_000 };

    expect(isCdnurNote(row({ ...value, invoiceDate: "2024-07-01" }))).toBe(false);
    expect(isCdnurNote(row({ ...value, invoiceDate: "2024-08-01" }))).toBe(true);
  });
});
