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

describe("reading the tax a template charged", () => {
  function innovativeInvoice(taxLine: string): string {
    return [
      "TAX INVOICE",
      "INNOVATIVE EXPORTS",
      "GSTIN- 09BUXPG2404E1ZM",
      "GSTIN No: 24AQBPM0946Q1ZJ",
      "INVOICE No- Dated",
      "WOODEN TRAIN 4421 PCS 48 285.00 13680.00",
      "Taxable Value 13680.00",
      "ADD CGST: 2.5% -",
      "ADD SGST: 2.5% -",
      taxLine,
      "2026-27/35 12-Aug-26",
    ].join("\n");
  }

  function read(text: string) {
    return extractInvoiceFromText({
      text,
      fileName: "26-27(35).PDF",
      fileSizeBytes: 9000,
      pageCount: 1,
      knownSupplierGstin: "09BUXPG2404E1ZM",
    });
  }

  it("reads an amount that follows a colon", () => {
    // "ADD IGST:5% 684.00" went unread because a colon was not among the
    // characters allowed after the tax's name, so an invoice of 13,680 was
    // reported carrying no tax at all.
    const invoice = read(innovativeInvoice("ADD IGST:5% 684.00"));

    expect(invoice.igstAmount).toBe(684);
    expect(invoice.totalInvoiceValue).toBe(14364);
    expect(invoice.gstRate).toBe(5);
  });

  it("does not read a rate as an amount where no tax was charged", () => {
    // The template prints a dash. Without the space this rule requires
    // before the amount, "2.5%" itself was read as 2.50 of tax.
    const invoice = read(innovativeInvoice("ADD IGST:5% -"));

    expect(invoice.cgstAmount).toBe(0);
    expect(invoice.sgstAmount).toBe(0);
  });

  it("believes the document over a supplier GSTIN that is not on it", () => {
    // The extractor passes whichever GSTIN the profile holds. Another
    // client's, taken on trust, made the real seller the buyer.
    const invoice = extractInvoiceFromText({
      text: innovativeInvoice("ADD IGST:5% 684.00"),
      fileName: "26-27(35).PDF",
      fileSizeBytes: 9000,
      pageCount: 1,
      knownSupplierGstin: "09FLRPK4935D1ZO",
    });

    expect(invoice.buyerGstin).toBe("24AQBPM0946Q1ZJ");
  });
});
