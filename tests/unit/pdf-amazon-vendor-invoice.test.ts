import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { extractTextFromPdfBuffer } from "@/features/pdf-extractor/engine/pdf-text-parser";
import { extractInvoiceFromText } from "@/features/pdf-extractor/engine/regex-invoice-extractor";
import type { ExtractedInvoice } from "@/features/pdf-extractor/domain/types";

/**
 * Real Amazon Vendor Central invoices. Every figure asserted here was read off
 * the printed PDF by hand, because the previous extractor was confidently wrong:
 * it reported 25.60 taxable on an invoice for 35,868.00, took the PO number
 * "819GAI2Q" as a 819 invoice total, and read the "1," of "1,793.40" as a 1%
 * tax rate.
 */
const DIR = path.resolve(__dirname, "../../Sample/new 19");

async function extract(fileName: string): Promise<ExtractedInvoice> {
  const buf = fs.readFileSync(path.join(DIR, fileName));
  const parsed = await extractTextFromPdfBuffer(buf);
  return extractInvoiceFromText({
    text: parsed.text,
    fileName,
    fileSizeBytes: buf.length,
    pageCount: parsed.pageCount,
  });
}

const ALL_PDFS = fs.readdirSync(DIR).filter((f) => f.endsWith(".pdf"));

describe("Amazon Vendor invoice extraction", () => {
  it("reads every figure off the printed GST Invoice layout", async () => {
    const inv = await extract("2026-2027_57.pdf");

    expect(inv.invoiceNumber).toBe("2026-2027/57");
    // Printed as 01/07/26 — DD/MM/YY. Read as MM/DD this landed in January,
    // a whole return period out.
    expect(inv.invoiceDate).toBe("2026-07-01");

    expect(inv.supplierGstin).toBe("09BHCPS1644C1ZI");
    expect(inv.buyerGstin).toBe("06AADCV4254H1ZC");
    expect(inv.classification).toBe("B2B");
    expect(inv.placeOfSupply).toBe("06");

    expect(inv.taxableValue).toBeCloseTo(35868.0, 2);
    expect(inv.igstAmount).toBeCloseTo(1793.4, 2);
    expect(inv.cgstAmount).toBe(0);
    expect(inv.sgstAmount).toBe(0);
    expect(inv.totalTaxAmount).toBeCloseTo(1793.4, 2);
    expect(inv.totalInvoiceValue).toBeCloseTo(37661.4, 2);
    expect(inv.gstRate).toBe(5);

    expect(inv.lineItems).toHaveLength(1);
    const item = inv.lineItems[0]!;
    expect(item.hsnCode).toBe("441900");
    expect(item.quantity).toBe(210);
    expect(item.rate).toBe(5);
    expect(item.taxableValue).toBeCloseTo(35868.0, 2);
  });

  it("splits CGST and SGST on the intra-state portal print", async () => {
    // Both parties are in UP (09), so this is intra-state and must not be IGST.
    const inv = await extract("2026-2027_62.pdf");

    expect(inv.invoiceNumber).toBe("2026-2027/62");
    expect(inv.invoiceDate).toBe("2026-07-05");
    expect(inv.supplierGstin.slice(0, 2)).toBe("09");
    expect(inv.buyerGstin.slice(0, 2)).toBe("09");
    expect(inv.placeOfSupply).toBe("09");

    expect(inv.igstAmount).toBe(0);
    expect(inv.cgstAmount).toBeCloseTo(1525.03, 2);
    expect(inv.sgstAmount).toBeCloseTo(1525.03, 2);
    expect(inv.taxableValue).toBeCloseTo(61001.15, 2);
    expect(inv.totalInvoiceValue).toBeCloseTo(64051.21, 2);
  });

  it("recovers rows whose quantity carries a separator or whose unit wraps", async () => {
    // 61 has a 1,480-quantity row and a row whose trailing "INR" wrapped to the
    // next line. Both were silently dropped, losing 250k of taxable value.
    const inv = await extract("2026-2027_61.pdf");
    expect(inv.lineItems).toHaveLength(20);
    expect(inv.lineItems.some((i) => i.quantity === 1480)).toBe(true);

    const sum = inv.lineItems.reduce((s, i) => s + i.taxableValue, 0);
    expect(sum).toBeCloseTo(inv.taxableValue, 1);
  });

  describe.each(ALL_PDFS)("%s", (fileName) => {
    it("balances and identifies both parties", async () => {
      const inv = await extract(fileName);

      // The arithmetic the GST portal will check.
      expect(inv.taxableValue + inv.totalTaxAmount).toBeCloseTo(inv.totalInvoiceValue, 1);
      expect(inv.taxableValue).toBeGreaterThan(0);

      expect(inv.invoiceNumber).toMatch(/^2026-2027\/\d+$/);
      expect(inv.invoiceDate).toMatch(/^2026-07-\d{2}$/);
      expect(inv.supplierGstin).toBe("09BHCPS1644C1ZI");
      expect(inv.buyerGstin).toMatch(/^\d{2}AADCV4254H/);
      expect(inv.classification).toBe("B2B");
      expect(inv.gstRate).toBe(5);

      // Interstate and intra-state are mutually exclusive.
      const interState = inv.supplierGstin.slice(0, 2) !== inv.placeOfSupply;
      if (interState) {
        expect(inv.igstAmount).toBeGreaterThan(0);
        expect(inv.cgstAmount + inv.sgstAmount).toBe(0);
      } else {
        expect(inv.igstAmount).toBe(0);
        expect(inv.cgstAmount).toBeCloseTo(inv.sgstAmount, 2);
      }
    });
  });

  it("accounts for the whole invoice in its line items", async () => {
    // A line item table that does not add up to the invoice is the failure that
    // quietly under-reports a return.
    for (const fileName of ALL_PDFS) {
      const inv = await extract(fileName);
      if (inv.notes.some((n) => n.includes("portal print"))) continue; // summary line by design

      const sum = inv.lineItems.reduce((s, i) => s + i.taxableValue, 0);
      expect(sum, `${fileName} line items must sum to the invoice`).toBeCloseTo(
        inv.taxableValue,
        1
      );
    }
  }, 60000);
});
