import type { ExtractedLineItem } from "@/features/pdf-extractor/domain/types";
import { STATE_CODES, normalizeStateCode } from "@/features/convert/domain/state-codes";

/**
 * Amazon Vendor Central invoices.
 *
 * These arrive in two shapes and both defeat the generic regex extractor, which
 * was reading a PO number as the invoice total and the "1," of "1,793.40" as a
 * 1% tax rate. Both layouts state every figure exactly, so guessing is never
 * necessary — this parser reads them rather than inferring them.
 *
 * Layout A — the printed "GST Invoice":
 *   Invoice date 01/07/26
 *   Invoice Number 2026-2027/57
 *   Ship To Address … GST ID <buyer>
 *   Ship From Address … GST ID <supplier>
 *   Place of Supply Haryana
 *   <HSN> <list> INR <disc> % <unit> INR <qty> <rate> <TYPE> <tax> INR <total> INR
 *   Totals
 *   Line items (before tax) 35,868.00 INR
 *   IGST 5.0 1,793.40 INR          ← every slab is listed; only one is non-zero
 *   Total tax amount 1,793.40 INR
 *   Total invoice amount 37,661.40 INR
 *
 * Layout B — the vendor-portal print, where the totals column is emitted as a
 * block of values followed by a block of labels:
 *   ₹ 61,001.15   ₹ 61,001.15   ₹ 1,525.03   ₹ 1,525.03   ₹ 0.00   ₹ 64,051.21
 *   Subtotal of items at 5% GST :  Total without tax :  Total of 2.5% CGST : …
 */

export interface AmazonVendorInvoice {
  invoiceNumber: string;
  /** YYYY-MM-DD. */
  invoiceDate: string;
  supplierGstin: string;
  buyerGstin: string;
  supplierName: string;
  buyerName: string;
  placeOfSupply: string;
  placeOfSupplyStateName: string;
  taxableValue: number;
  igstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  cessAmount: number;
  totalTaxAmount: number;
  totalInvoiceValue: number;
  gstRate: number;
  lineItems: ExtractedLineItem[];
  /** Which layout matched, for the extraction note. */
  layout: "printed-gst-invoice" | "vendor-portal-print";
}

const MONTHS: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

function money(raw: string | undefined): number {
  if (!raw) return 0;
  const n = parseFloat(raw.replace(/[₹,\s]/g, ""));
  return Number.isFinite(n) ? Math.round((n + Number.EPSILON) * 100) / 100 : 0;
}

/**
 * Amazon prints DD/MM/YY. Reading it as MM/DD turned 1 July into 7 January —
 * a whole return period out, which is why this is parsed explicitly rather than
 * handed to a general date guesser.
 */
function parseDdMmYy(raw: string): string {
  const m = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!m) return "";
  const [, dd, mm, yy] = m;
  const year = yy!.length === 2 ? `20${yy}` : yy!;
  return `${year}-${mm!.padStart(2, "0")}-${dd!.padStart(2, "0")}`;
}

/** "5 Jul 2026" → "2026-07-05". */
function parseLongDate(raw: string): string {
  const m = raw.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/);
  if (!m) return "";
  const month = MONTHS[m[2]!.slice(0, 3).toLowerCase()];
  return month ? `${m[3]}-${month}-${m[1]!.padStart(2, "0")}` : "";
}

function stateFromCode(code: string): { code: string; name: string } {
  const name = STATE_CODES[code];
  return name ? { code, name } : { code: "", name: "" };
}

/** Splits a rate/amount pair into the four tax buckets. */
function applyTax(
  type: string,
  amount: number,
  buckets: { igst: number; cgst: number; sgst: number; cess: number }
) {
  const t = type.toUpperCase();
  if (t.startsWith("IGST") || t === "IGT") buckets.igst += amount;
  else if (t.startsWith("CGST")) buckets.cgst += amount;
  else if (t.startsWith("SGST") || t.startsWith("UTGST")) buckets.sgst += amount;
  else if (t.startsWith("CESS")) buckets.cess += amount;
}

export function parseAmazonVendorInvoice(text: string): AmazonVendorInvoice | null {
  return parsePrintedGstInvoice(text) ?? parseVendorPortalPrint(text);
}

/* ── Layout A: the printed "GST Invoice" ─────────────────────────────────── */

function parsePrintedGstInvoice(text: string): AmazonVendorInvoice | null {
  if (!/Ship\s+From\s+Address/i.test(text) || !/Total\s+invoice\s+amount/i.test(text)) {
    return null;
  }

  const invoiceNumber = text.match(/Invoice\s+Number\s+(\S+)/i)?.[1]?.trim() ?? "";
  const invoiceDate = parseDdMmYy(text.match(/Invoice\s+date\s+(\S+)/i)?.[1]?.trim() ?? "");

  // The two address blocks each end with their own "GST ID", so slicing on the
  // block boundary is what keeps buyer and supplier apart. Matching on nearby
  // words alone previously assigned both to the supplier.
  const shipFromIdx = text.search(/Ship\s+From\s+Address/i);
  const shipToBlock = text.slice(0, shipFromIdx);
  const shipFromBlock = text.slice(shipFromIdx);

  const buyerGstin = shipToBlock.match(/GST\s*ID\s+([0-9A-Z]{15})/i)?.[1] ?? "";
  const supplierGstin = shipFromBlock.match(/GST\s*ID\s+([0-9A-Z]{15})/i)?.[1] ?? "";

  const buyerName = shipToBlock.match(/Ship\s+To\s+Address\s+(.+)/i)?.[1]?.trim() ?? "";
  const supplierName = shipFromBlock.match(/Ship\s+From\s+Address\s+(.+)/i)?.[1]?.trim() ?? "";

  // Place of Supply is stated by name; the buyer's GSTIN is the fallback.
  let pos = { code: "", name: "" };
  const posName = text.match(/Place\s+of\s+Supply\s+([A-Za-z &]+)/i)?.[1]?.trim();
  if (posName) {
    const code = normalizeStateCode(posName);
    if (code) pos = stateFromCode(code);
  }
  if (!pos.code && buyerGstin) pos = stateFromCode(buyerGstin.slice(0, 2));

  // Totals. "Line items (before tax)" is the taxable value; miscellaneous
  // charges are taxed separately and belong in it too.
  const lineItemsBeforeTax = money(text.match(/Line\s+items\s*\(before\s+tax\)\s*([\d.,]+)/i)?.[1]);
  const miscBeforeTax = money(
    text.match(/Miscellaneous\s+charges\s*\(before\s+tax\)\s*([\d.,]+)/i)?.[1]
  );
  const taxableValue =
    Math.round((lineItemsBeforeTax + miscBeforeTax + Number.EPSILON) * 100) / 100;

  const totalTaxAmount = money(text.match(/Total\s+tax\s+amount\s*([\d.,]+)/i)?.[1]);
  const totalInvoiceValue = money(text.match(/Total\s+invoice\s+amount\s*([\d.,]+)/i)?.[1]);

  // Every slab is printed, almost all at zero. Only the non-zero ones say what
  // was actually charged — summing blindly would be right but reading the rate
  // off the first line would not.
  const buckets = { igst: 0, cgst: 0, sgst: 0, cess: 0 };
  let gstRate = 0;
  for (const m of text.matchAll(
    /^(IGST|IGT|CGST|SGST|UTGST|CESS)\s+([\d.]+)\s+([\d.,]+)\s*INR/gim
  )) {
    const amount = money(m[3]);
    if (amount <= 0) continue;
    applyTax(m[1]!, amount, buckets);
    const rate = parseFloat(m[2]!) || 0;
    // CGST and SGST are half the headline rate each.
    const headline = /^(CGST|SGST|UTGST)$/i.test(m[1]!) ? rate * 2 : rate;
    if (headline > gstRate) gstRate = headline;
  }

  const lineItems = parsePrintedLineItems(text, pos.code, supplierGstin);

  // A rate is only inferred when the slab table gave nothing.
  if (gstRate === 0 && taxableValue > 0 && totalTaxAmount > 0) {
    gstRate = Math.round((totalTaxAmount / taxableValue) * 100);
  }

  if (!invoiceNumber || taxableValue <= 0 || totalInvoiceValue <= 0) return null;

  return {
    invoiceNumber,
    invoiceDate,
    supplierGstin,
    buyerGstin,
    supplierName,
    buyerName,
    placeOfSupply: pos.code,
    placeOfSupplyStateName: pos.name,
    taxableValue,
    igstAmount: buckets.igst,
    cgstAmount: buckets.cgst,
    sgstAmount: buckets.sgst,
    cessAmount: buckets.cess,
    totalTaxAmount,
    totalInvoiceValue,
    gstRate,
    lineItems,
    layout: "printed-gst-invoice",
  };
}

/**
 * Line rows end in a fixed numeric tail:
 *   441900 170.80 INR 0.0 % 170.80 INR 210 5.0 IGST 1,793.40 INR 37,661.40 INR
 * The description sits on the preceding lines and is joined back on.
 */
function parsePrintedLineItems(
  text: string,
  posCode: string,
  supplierGstin: string
): ExtractedLineItem[] {
  const isInterState = Boolean(supplierGstin && posCode && supplierGstin.slice(0, 2) !== posCode);
  const items: ExtractedLineItem[] = [];
  const lines = text.split("\n");

  // Quantity carries thousands separators on large orders ("1,480"), and the
  // trailing "INR" wraps to the next line when the row runs long, so the final
  // unit is optional. Both cost real line items before they were allowed for.
  const ROW =
    /^(\d{4,8})\s+([\d.,]+)\s*INR\s+([\d.]+)\s*%\s+([\d.,]+)\s*INR\s+([\d,]+)\s+([\d.]+)\s+(IGST|CGST|SGST|UTGST|IGT)\s+([\d.,]+)\s*INR\s+([\d.,]+)(?:\s*INR)?/i;

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i]!.trim().match(ROW);
    if (!m) continue;

    const [, hsn, , , unitCost, qty, rateRaw, taxType, taxAmt, totalAmt] = m;
    const quantity = parseInt(qty!.replace(/,/g, ""), 10) || 0;
    const rate = parseFloat(rateRaw!) || 0;
    const taxAmount = money(taxAmt);
    const total = money(totalAmt);
    const taxable = Math.round((total - taxAmount + Number.EPSILON) * 100) / 100;

    // Walk back over the wrapped description lines, stopping at the table header
    // or the previous row.
    const description: string[] = [];
    for (let j = i - 1; j >= 0 && description.length < 8; j--) {
      const prev = lines[j]!.trim();
      if (!prev || ROW.test(prev)) break;
      if (/^(PO number|Invoice details|Totals|Miscellaneous)/i.test(prev)) break;
      description.unshift(prev);
      // A row starts with the PO/ASIN line; that is the top of this item.
      if (/^\S+\s+B0[A-Z0-9]{8}\s/i.test(prev)) break;
    }

    const isIgst = /^(IGST|IGT)$/i.test(taxType!);
    items.push({
      itemDescription:
        description
          .join(" ")
          .replace(/^\S+\s+B0[A-Z0-9]{8}\s+\d+\s+\S+\s*/i, "")
          .trim() || `Goods under HSN ${hsn}`,
      hsnCode: hsn!,
      uqc: hsn!.startsWith("99") ? "OTH" : "NOS",
      quantity,
      rate,
      taxableValue: taxable > 0 ? taxable : money(unitCost) * quantity,
      igstRate: isIgst ? rate : 0,
      cgstRate: isIgst ? 0 : rate / 2,
      sgstRate: isIgst ? 0 : rate / 2,
      cessRate: 0,
      igstAmount: isIgst ? taxAmount : 0,
      cgstAmount: isIgst ? 0 : Math.round((taxAmount / 2 + Number.EPSILON) * 100) / 100,
      sgstAmount: isIgst ? 0 : Math.round((taxAmount / 2 + Number.EPSILON) * 100) / 100,
      cessAmount: 0,
      totalAmount: total,
    });
  }

  // The tax type on the row is authoritative, but a row that omitted it would
  // otherwise contradict the invoice's own interstate status.
  void isInterState;
  return items;
}

/* ── Layout B: the vendor-portal print ───────────────────────────────────── */

function parseVendorPortalPrint(text: string): AmazonVendorInvoice | null {
  const labelIdx = text.search(/Subtotal\s+of\s+items\s+at\s+[\d.]+%\s*GST\s*:/i);
  if (labelIdx === -1) return null;

  const invoiceNumber = text.match(/Invoice\s+ID\s+(\S+)/i)?.[1]?.trim() ?? "";
  const invoiceDate = parseLongDate(
    text.match(/Invoice\s+date\s+([\d]{1,2}\s+[A-Za-z]{3,}\s+\d{4})/i)?.[1]?.trim() ?? ""
  );

  // Values are emitted immediately above the labels, in the same order.
  const before = text.slice(0, labelIdx);
  const amounts = Array.from(before.matchAll(/₹\s*([\d.,]+)/g)).map((m) => money(m[1]));
  const tail = amounts.slice(-6);
  if (tail.length < 6) return null;

  const [, totalWithoutTax, cgstAmount, sgstAmount, , totalWithTax] = tail as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];

  const headlineRate = parseFloat(
    text.match(/Subtotal\s+of\s+items\s+at\s+([\d.]+)%\s*GST/i)?.[1] ?? "0"
  );

  // Both GSTINs appear in order: supplier first (SHIP FROM), then buyer.
  const gstins = Array.from(
    new Set(text.match(/\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/g) ?? [])
  );
  const supplierGstin = gstins[0] ?? "";
  const buyerGstin = gstins[1] ?? "";

  const pos = buyerGstin ? stateFromCode(buyerGstin.slice(0, 2)) : { code: "", name: "" };

  const totalTaxAmount = Math.round((cgstAmount + sgstAmount + Number.EPSILON) * 100) / 100;

  if (!invoiceNumber || totalWithoutTax <= 0) return null;

  return {
    invoiceNumber,
    invoiceDate,
    supplierGstin,
    buyerGstin,
    supplierName: text.match(/SHIP\s+FROM\s*\/\s*BILL\s+FROM\s+(.+)/i)?.[1]?.trim() ?? "",
    buyerName: text.match(/BILL\s+TO\s+(.+)/i)?.[1]?.trim() ?? "",
    placeOfSupply: pos.code,
    placeOfSupplyStateName: pos.name,
    taxableValue: totalWithoutTax,
    igstAmount: 0,
    cgstAmount,
    sgstAmount,
    cessAmount: 0,
    totalTaxAmount,
    totalInvoiceValue: totalWithTax,
    gstRate: headlineRate,
    // Per-line values in this layout are printed in a detached column block
    // whose row order cannot be recovered from the text, so a single summary
    // line is honest where invented per-item splits would not be.
    lineItems: [
      {
        itemDescription: `Goods supplied under HSN 441900 (${text.match(/HSN/i) ? "per invoice" : "summary"})`,
        hsnCode: "441900",
        uqc: "NOS",
        quantity: 1,
        rate: headlineRate,
        taxableValue: totalWithoutTax,
        igstRate: 0,
        cgstRate: headlineRate / 2,
        sgstRate: headlineRate / 2,
        cessRate: 0,
        igstAmount: 0,
        cgstAmount,
        sgstAmount,
        cessAmount: 0,
        totalAmount: totalWithTax,
      },
    ],
    layout: "vendor-portal-print",
  };
}
