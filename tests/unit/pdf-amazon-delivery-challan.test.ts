import { describe, it, expect } from "vitest";
import { extractInvoiceFromText } from "@/features/pdf-extractor/engine/regex-invoice-extractor";

/** The shape of Amazon's "DELIVERY CHALLAN/ TAX INVOICE" as unpdf reads it. */
function challan(documentNumber: string, documentDate: string): string {
  return [
    "DELIVERY CHALLAN/ TAX INVOICE",
    "Ship from : Ship to :",
    "Antique Store",
    "Uttar Pradesh (State/UT Code: 9)",
    "GSTIN : 09KLJPS4652C1ZN",
    "Care of :",
    "ASSPL - Haryana",
    "HARYANA (State/UT Code: 6)",
    "GSTIN : 06KLJPS4652C1ZT",
    "Place of supply : HARYANA (State/UT Code: 6)",
    "Place of delivery : HARYANA (State/UT Code: 6)",
    `Document Number ${documentNumber}`,
    `FBA Shipment ID ${documentNumber}`,
    "IRN Number (Optional)",
    `Document Date ${documentDate}`,
    "Purpose of transfer Stock Transfer",
    "1 WOOD ART STORE Hanging Wall Brackte",
    "40 57.14 441900 2,285.71 5.00% 114.29 0.00% 0.00 2,400.00",
    "Total 185 438.10 18,714.29 935.71 0.00 19,650.00",
    "Total Value of Goods Incl. Tax : 19,650.00",
  ].join("\n");
}

function extract(text: string) {
  return extractInvoiceFromText({
    text,
    fileName: "DeliveryChallan.pdf",
    fileSizeBytes: 7000,
    pageCount: 1,
    knownSupplierGstin: "09KLJPS4652C1ZN",
  });
}

describe("Amazon's delivery challan", () => {
  it("reads the document number rather than the 'Ship from' label", () => {
    // There was no pattern for "Document Number", so the loosest rule read the
    // word after "TAX INVOICE" — the label "Ship" — and seven challans were
    // all numbered "Ship".
    expect(extract(challan("FBA15M3NST8K", "08/16/2026")).invoiceNumber).toBe("FBA15M3NST8K");
  });

  it("reads the American date this layout prints", () => {
    // Read day-first, "08/16/2026" produced month 16 and an invoice date of
    // "2026-16-08", which the portal rejects outright.
    expect(extract(challan("FBA15M57TBHH", "08/16/2026")).invoiceDate).toBe("2026-08-16");
  });

  it("reads a date that is ambiguous on its digits alone", () => {
    // "08/01/2026" gives nothing away, and day-first makes it 8 January —
    // a different return entirely. The layout settles it, not the digits.
    expect(extract(challan("FBA15M3NST8K", "08/01/2026")).invoiceDate).toBe("2026-08-01");
  });

  it("reads the place of supply from the spelled-out state code", () => {
    // "HARYANA (State/UT Code: 6)" matched no bracket rule, so the place of
    // supply fell back to the supplier's own state — which turns an
    // inter-state supply into an intra-state one, taxed in the wrong state.
    expect(extract(challan("FBA15M3NST8K", "08/16/2026")).placeOfSupply).toBe("06");
  });
});
