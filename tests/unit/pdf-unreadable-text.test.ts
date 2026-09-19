import { describe, it, expect } from "vitest";
import { extractInvoiceFromText } from "@/features/pdf-extractor/engine/regex-invoice-extractor";

function extract(text: string) {
  return extractInvoiceFromText({
    text,
    fileName: "sample.pdf",
    fileSizeBytes: 1024,
    pageCount: 1,
  });
}

/**
 * Some PDFs carry a text layer that decodes to nonsense — a scan, or an
 * embedded font with no character map. Nothing can be read from one, and what
 * came back was an invoice with every figure zero and no indication why.
 */
describe("a PDF whose text layer cannot be decoded", () => {
  const GARBLED = `Invoice/ onCisngenm nome
CONSIGNOR N AM E tASHUTAS OHKtM
GSUIN E -ttV RL27-PJ8
CGSU gHeW(x i YYe)5
SGSU b :UGSU gHeW(x i YYe)5
U8s67 U6n t83.s 1 Yfb32`;

  it("says so instead of returning an invoice of zeros", () => {
    const result = extract(GARBLED);

    expect(result.notes[0]).toMatch(/could not be read/i);
    expect(result.notes[0]).toMatch(/scan|character map/i);
    expect(result.confidenceScore).toBe(0);
  });

  it("tells the user what to do about it", () => {
    expect(extract(GARBLED).notes[0]).toMatch(/enter it manually|text-based copy/i);
  });
});

describe("a readable invoice is left alone", () => {
  it("does not flag an ordinary invoice", () => {
    const readable = `Tax Invoice
Invoice Number
ly5kw2712
Invoice Date
25-07-2026
Place of Supply : 19 West Bengal
HSN 8518 Qty 1 Taxable Rs.270.74 IGST @18.0% :Rs.48.73 Total Rs.319.47
Sold by: MUBEENUDDIN, Saharanpur, Uttar Pradesh 247001, 09BSPPM4133G1ZI`;

    const result = extract(readable);

    expect(result.notes.join(" ")).not.toMatch(/could not be read/i);
    expect(result.invoiceNumber).toBe("ly5kw2712");
    // The state code is printed beside the name; reading only the name made
    // this fall back to the supplier's own state, turning an inter-state
    // supply into an intra-state one.
    expect(result.placeOfSupply).toBe("19");
    expect(result.taxableValue).toBe(270.74);
    expect(result.igstAmount).toBe(48.73);
    expect(result.totalInvoiceValue).toBe(319.47);
  });

  it("does not flag an invoice that merely uses an unfamiliar layout", () => {
    // Missing vocabulary alone is not proof of a decoding failure; a GSTIN
    // means the text decoded.
    const sparse = "27AAJCP8507D1ZC\nsome unusual wording\n1,000.00";

    expect(extract(sparse).notes.join(" ")).not.toMatch(/could not be read/i);
  });
});
