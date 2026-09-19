import { describe, it, expect } from "vitest";
import {
  buildHsnSummary,
  normalizeHsn,
  hsnDescription,
} from "@/features/convert/domain/hsn-summary";
import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";

function row(over: Partial<NormalizedInvoiceRow>): NormalizedInvoiceRow {
  return {
    id: crypto.randomUUID(),
    rowIndex: 0,
    transactionType: "Sales",
    invoiceNumber: "IN-1",
    invoiceDate: "2026-08-01",
    invoiceType: "B2CS",
    buyerName: "Customer",
    buyerGstin: "",
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

describe("canonicalising an HSN code", () => {
  it("pads a 4-digit heading to the 6-digit form", () => {
    // Marketplace feeds spell one commodity both ways, which split a single
    // HSN into two rows that disagreed with the filed return.
    expect(normalizeHsn("4419")).toBe("441900");
    expect(normalizeHsn("441900")).toBe("441900");
  });

  it("keeps 6 and 8 digit codes as they are", () => {
    expect(normalizeHsn("732690")).toBe("732690");
    expect(normalizeHsn("44219090")).toBe("44219090");
  });

  it("returns nothing for a code that classifies nothing", () => {
    // The portal rejects these outright, and before the placeholder code was
    // removed they were quietly reported as IT consulting services.
    expect(normalizeHsn("")).toBe("");
    expect(normalizeHsn(undefined)).toBe("");
    expect(normalizeHsn("000000")).toBe("");
    expect(normalizeHsn("44")).toBe("");
  });

  it("keeps one readable description, not a catalogue", () => {
    expect(hsnDescription("Tray; Coaster; Bowl")).toBe("Tray");
    expect(hsnDescription("x".repeat(80)).length).toBeLessThanOrEqual(60);
  });
});

describe("Table 12", () => {
  it("merges the two spellings of one commodity", () => {
    const summary = buildHsnSummary([
      row({ hsnCode: "4419" }),
      row({ hsnCode: "441900", invoiceNumber: "IN-2" }),
    ]);

    expect(summary.b2c).toHaveLength(1);
    expect(summary.b2c[0]!.hsnCode).toBe("441900");
    expect(summary.b2c[0]!.taxableValue).toBe(2000);
  });

  it("splits supplies to registered and unregistered persons", () => {
    const summary = buildHsnSummary([
      row({ invoiceType: "B2B", buyerGstin: "06AADCV4254H1ZC" }),
      row({ invoiceType: "B2CS", invoiceNumber: "IN-2" }),
    ]);

    expect(summary.b2b).toHaveLength(1);
    expect(summary.b2c).toHaveLength(1);
  });

  it("leaves out a row that classifies nothing, and says what it was worth", () => {
    // Written straight through, a blank code became an hsn_sc of "" and the
    // portal refused the file.
    const summary = buildHsnSummary([
      row({ hsnCode: "" }),
      row({ hsnCode: "000000", invoiceNumber: "IN-2", taxableValue: 500 }),
      row({ hsnCode: "441900", invoiceNumber: "IN-3" }),
    ]);

    expect(summary.b2c.map((r) => r.hsnCode)).toEqual(["441900"]);
    expect(summary.unclassified.rows).toBe(2);
    expect(summary.unclassified.taxableValue).toBe(1500);
  });

  it("nets a credit note against its commodity", () => {
    const summary = buildHsnSummary([
      row({ taxableValue: 1000 }),
      row({
        invoiceType: "CDNCS",
        transactionType: "Return",
        taxableValue: 400,
        invoiceNumber: "CN-1",
      }),
    ]);

    expect(summary.b2c[0]!.taxableValue).toBe(600);
  });

  it("drops a commodity whose returns outweighed its sales", () => {
    // It survived an absolute-value filter as a negative, and the generators
    // clamp with Math.max(0, …) on the way out — so an all-zero HSN row
    // reached the return, which the portal rejects.
    const summary = buildHsnSummary([
      row({ taxableValue: 100 }),
      row({
        invoiceType: "CDNCS",
        transactionType: "Return",
        taxableValue: 400,
        invoiceNumber: "CN-1",
      }),
    ]);

    expect(summary.b2c).toHaveLength(0);
  });

  it("keeps different rates apart", () => {
    const summary = buildHsnSummary([
      row({ igstRate: 5 }),
      row({ igstRate: 18, invoiceNumber: "IN-2" }),
    ]);

    expect(summary.b2c.map((r) => r.rate).sort((a, b) => a - b)).toEqual([5, 18]);
  });

  it("returns nothing for no rows", () => {
    expect(buildHsnSummary([])).toEqual({
      b2b: [],
      b2c: [],
      unclassified: { rows: 0, taxableValue: 0 },
    });
  });
});
