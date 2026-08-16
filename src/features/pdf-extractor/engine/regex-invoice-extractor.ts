import type { ExtractedInvoice, ExtractedLineItem } from "@/features/pdf-extractor/domain/types";
import { classifyInvoice } from "@/features/pdf-extractor/domain/classifier";
import {
  normalizeStateCode,
  STATE_CODES,
} from "@/features/convert/domain/state-codes";
import { transformDate } from "@/features/convert/engine/transformation/transformers";

function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function parseAmount(raw: unknown): number {
  if (typeof raw === "number") return isNaN(raw) ? 0 : r2(raw);
  const str = String(raw || "")
    .replace(/[₹`,\s]/g, "")
    .replace(/\/-$/, "")
    .trim();
  const n = parseFloat(str);
  return isNaN(n) ? 0 : r2(n);
}

const GSTIN_REGEX = /[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}/g;

export function extractInvoiceFromText(params: {
  text: string;
  fileName: string;
  fileSizeBytes: number;
  pageCount: number;
  knownSupplierGstin?: string;
}): ExtractedInvoice {
  const { text, fileName, fileSizeBytes, pageCount, knownSupplierGstin } = params;
  const notes: string[] = [];

  // 1. Find all GSTINs in text
  const gstinMatches = Array.from(new Set(text.match(GSTIN_REGEX) || []));
  let supplierGstin = knownSupplierGstin || "";
  let buyerGstin = "";

  if (gstinMatches.length === 1) {
    const idx = text.indexOf(gstinMatches[0]!);
    const beforeText = text.substring(Math.max(0, idx - 150), idx).toLowerCase();
    if (
      beforeText.includes("billed to") ||
      beforeText.includes("issued to") ||
      beforeText.includes("shipped to") ||
      beforeText.includes("goods shipped") ||
      beforeText.includes("customer") ||
      beforeText.includes("buyer")
    ) {
      buyerGstin = gstinMatches[0]!;
    } else {
      supplierGstin = gstinMatches[0]!;
    }
  } else if (gstinMatches.length >= 2) {
    for (const g of gstinMatches) {
      const idx = text.indexOf(g);
      const beforeText = text.substring(Math.max(0, idx - 150), idx).toLowerCase();
      if (
        beforeText.includes("billed to") ||
        beforeText.includes("issued to") ||
        beforeText.includes("shipped to") ||
        beforeText.includes("goods shipped") ||
        beforeText.includes("customer") ||
        beforeText.includes("buyer") ||
        beforeText.includes("recipient")
      ) {
        buyerGstin = g;
      } else if (
        beforeText.includes("sold by") ||
        beforeText.includes("from") ||
        beforeText.includes("supplier") ||
        beforeText.includes("seller") ||
        !supplierGstin
      ) {
        supplierGstin = g;
      }
    }
    if (!supplierGstin && gstinMatches[0]) supplierGstin = gstinMatches[0];
    if (!buyerGstin && gstinMatches[1] && gstinMatches[1] !== supplierGstin) {
      buyerGstin = gstinMatches[1];
    }
  }

  // 2. Invoice Number
  let invoiceNumber = "";
  const invPatterns = [
    /Invoice\s*#\s*[:\s]*([A-Za-z0-9\-\/_]+)/i,
    /Invoice\s*No\.?\s*[:\s]*([A-Za-z0-9\-\/_]+)/i,
    /Tax\s*Invoice\s*(?:#|No\.?)\s*[:#\s-]*([A-Za-z0-9\-\/_]+)/i,
    /Bill\s*No\.?\s*[:#\s-]*([A-Za-z0-9\-\/_]+)/i,
    /Invoice\s*[:#\s-]*([A-Za-z0-9\-\/_]{3,25})/i,
  ];
  for (const pat of invPatterns) {
    const m = text.match(pat);
    if (m?.[1] && m[1].length >= 2 && !/^(date|dated|original|duplicate|tax)$/i.test(m[1].trim())) {
      invoiceNumber = m[1].trim();
      break;
    }
  }

  // 3. Invoice Date
  let rawDate = "";
  const datePatterns = [
    /(?:Dated|Invoice\s*Date|Date)\s*[:#\s-]*(\d{1,2}[-\/.]\d{1,2}[-\/.]\d{2,4})/i,
    /(?:Dated|Invoice\s*Date|Date)\s*[:#\s-]*(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4})/i,
    /(\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2})/,
  ];
  for (const pat of datePatterns) {
    const m = text.match(pat);
    if (m?.[1]) {
      rawDate = m[1].trim();
      break;
    }
  }
  const invoiceDate = transformDate(rawDate) || rawDate;

  // 4. Place of Supply (POS)
  let posCode = "";
  let posName = "";

  const posMatch = text.match(/Place\s*of\s*Supply\s*[:\s-]*([A-Za-z\s&]+?)(?:\n|\r|\t|Billing|Shipping|Order|$)/i);
  if (posMatch?.[1]) {
    const candidate = posMatch[1].trim();
    posCode = normalizeStateCode(candidate);
    if (posCode && STATE_CODES[posCode]) {
      posName = STATE_CODES[posCode] ?? "";
    }
  }

  if (!posCode) {
    const stateCodeMatch = text.match(/(?:State\s*(?:\(Code\)|Code)?)\s*[:\s-]*(\d{1,2})/i);
    if (stateCodeMatch?.[1]) {
      posCode = normalizeStateCode(stateCodeMatch[1]);
      if (posCode && STATE_CODES[posCode]) {
        posName = STATE_CODES[posCode] ?? "";
      }
    }
  }

  if (!posCode && buyerGstin) {
    posCode = buyerGstin.slice(0, 2);
    if (posCode && STATE_CODES[posCode]) posName = STATE_CODES[posCode] ?? "";
  }

  if (!posCode && supplierGstin) {
    posCode = supplierGstin.slice(0, 2);
    if (posCode && STATE_CODES[posCode]) posName = STATE_CODES[posCode] ?? "";
  }

  // 5. Financials Extraction
  // Taxable Value
  let taxableValue = 0;
  const taxablePatterns = [
    /Total\s*\(\s*excluding\s*Tax\s*\)\s*[:\s]*([0-9,]+\.?[0-9]*)/i,
    /Taxable\s*Value\s*[:\s₹`]*([0-9,]+\.?[0-9]*)/i,
    /Total\s*Taxable\s*Value\s*(?:Rs\.?|INR|₹|`)?\s*[:\s]*([0-9,]+\.?[0-9]*)/i,
    /Sub\s*total\s*(?:Rs\.?|INR|₹|`)?\s*[:\s]*([0-9,]+\.?[0-9]*)/i,
    /₹\s*([0-9,]+\.?[0-9]*)\s*SGST\s*@/i,
  ];
  for (const pat of taxablePatterns) {
    const m = text.match(pat);
    if (m?.[1]) {
      const val = parseAmount(m[1]);
      if (val > 0) {
        taxableValue = val;
        break;
      }
    }
  }

  // Taxes: CGST, SGST, IGST, Cess
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;
  let cessAmount = 0;
  let cgstRate = 0;
  let sgstRate = 0;
  let igstRate = 0;

  const cgstMatch = text.match(/CGST(?:%|\s*@)?\s*(\d+\.?\d*)%?\s*[:\s₹`]*([0-9,]+\.?[0-9]*)/i);
  if (cgstMatch) {
    if (cgstMatch[1]) cgstRate = parseFloat(cgstMatch[1]) || 0;
    if (cgstMatch[2]) cgstAmount = parseAmount(cgstMatch[2]);
  }

  const sgstMatch = text.match(/(?:ADD\s*)?(?:SGST|UTGST)(?:%|\s*@)?\s*(\d+\.?\d*)%?\s*[:\s₹`]*([0-9,]+\.?[0-9]*)/i);
  if (sgstMatch) {
    if (sgstMatch[1]) sgstRate = parseFloat(sgstMatch[1]) || 0;
    if (sgstMatch[2]) sgstAmount = parseAmount(sgstMatch[2]);
  }

  const igstMatch = text.match(/IGST(?:%|\s*@)?\s*(\d+\.?\d*)%?\s*[:\s₹`]*([0-9,]+\.?[0-9]*)/i);
  if (igstMatch) {
    if (igstMatch[1]) igstRate = parseFloat(igstMatch[1]) || 0;
    if (igstMatch[2]) igstAmount = parseAmount(igstMatch[2]);
  }

  const cessMatch = text.match(/Cess\s*(?:Rs\.?|Amount)?\s*[:\s₹`]*([0-9,]+\.?[0-9]*)/i);
  if (cessMatch?.[1]) {
    cessAmount = parseAmount(cessMatch[1]);
  }

  // Total Invoice Value
  let totalInvoiceValue = 0;
  const totalPatterns = [
    /TOTAL\s*INVOICE\s*VALUE\s*(?:\(Figure\))?\s*[:\s₹`]*([0-9,]+\.?[0-9]*)/i,
    /Total\s*Amount\s*[:\s₹`]*([0-9,]+\.?[0-9]*)/i,
    /Grand\s*Total\s*[:\s₹`]*([0-9,]+\.?[0-9]*)/i,
    /₹\s*([0-9,]+\.?[0-9]*)\s*\/-/i,
    /Total\s*Invoice\s*Value\s*[:\s₹`]*([0-9,]+\.?[0-9]*)/i,
  ];
  for (const pat of totalPatterns) {
    const m = text.match(pat);
    if (m?.[1]) {
      const val = parseAmount(m[1]);
      if (val > 0) {
        totalInvoiceValue = val;
        break;
      }
    }
  }

  // If tax amounts are missing but total tax is present
  const taxTotalMatch = text.match(/Tax(?:\s*Total)?\s*[:\s₹`]*([0-9,]+\.?[0-9]*)/i);
  let totalTaxAmount = r2(cgstAmount + sgstAmount + igstAmount + cessAmount);

  if (totalTaxAmount === 0 && taxTotalMatch?.[1]) {
    totalTaxAmount = parseAmount(taxTotalMatch[1]);
    const isInter = Boolean(supplierGstin && posCode && supplierGstin.slice(0, 2) !== posCode);
    if (isInter) {
      igstAmount = totalTaxAmount;
    } else {
      cgstAmount = r2(totalTaxAmount / 2);
      sgstAmount = r2(totalTaxAmount / 2);
    }
  }

  if (taxableValue === 0 && totalInvoiceValue > 0 && totalTaxAmount > 0) {
    taxableValue = r2(totalInvoiceValue - totalTaxAmount);
  }
  if (totalInvoiceValue <= 1 || totalInvoiceValue < taxableValue) {
    totalInvoiceValue = r2(taxableValue + totalTaxAmount);
  }

  let gstRate = 0;
  if (igstRate > 0) gstRate = igstRate;
  else if (cgstRate > 0 || sgstRate > 0) gstRate = cgstRate + sgstRate;
  else if (taxableValue > 0 && totalTaxAmount > 0) {
    gstRate = Math.round((totalTaxAmount / taxableValue) * 100);
  }

  // If rate is still 0, check GST Rate column in tables: e.g. "GST Rate Quantity ... 5 50"
  if (gstRate === 0) {
    const tableRateMatch = text.match(/GST\s*\n*Rate[^\n]*\n[^\n]*\s(\d{1,2})\s+\d+/i);
    if (tableRateMatch?.[1]) {
      gstRate = parseFloat(tableRateMatch[1]) || 0;
      if (gstRate > 0 && taxableValue > 0 && totalTaxAmount === 0) {
        totalTaxAmount = r2(taxableValue * (gstRate / 100));
        const isInter = Boolean(supplierGstin && posCode && supplierGstin.slice(0, 2) !== posCode);
        if (isInter) {
          igstAmount = totalTaxAmount;
        } else {
          cgstAmount = r2(totalTaxAmount / 2);
          sgstAmount = r2(totalTaxAmount / 2);
        }
        totalInvoiceValue = r2(taxableValue + totalTaxAmount);
      }
    }
  }

  // 6. HSN / SAC Code & Description
  let hsnCode = "";
  let itemDescription = "Goods/Services";

  const hsnMatch = text.match(/(?:HSN|SAC|HSN\s*\/|\bSAC\s*Code|\bHSN\s*Code)\s*[:#\s-]*(\d{4,8})/i);
  const sacMatch = text.match(/\b(99\d{4})\b/);
  const eazeMatch = text.match(/\d+\.\s*(\d{4,8})\s+([^\n\r]+)/i);
  const tableHsnMatch = text.match(/\n\s*(\d{4,8})\s+\d{1,2}\s+\d+/);

  if (hsnMatch?.[1]) {
    hsnCode = hsnMatch[1].trim();
    itemDescription = `Goods supplied under HSN ${hsnCode}`;
  } else if (sacMatch?.[1]) {
    hsnCode = sacMatch[1].trim();
    itemDescription = `Services supplied under SAC ${hsnCode}`;
  } else if (eazeMatch?.[1]) {
    hsnCode = eazeMatch[1].trim();
    itemDescription = eazeMatch[2]?.trim() || `Software services under SAC ${hsnCode}`;
  } else if (tableHsnMatch?.[1]) {
    hsnCode = tableHsnMatch[1].trim();
    itemDescription = `Goods supplied under HSN ${hsnCode}`;
  } else {
    hsnCode = "4419";
    itemDescription = `Goods supplied under HSN 4419`;
  }

  // 7. Line Item Extraction
  const lineItems: ExtractedLineItem[] = [
    {
      itemDescription,
      hsnCode,
      uqc: hsnCode.startsWith("99") ? "OTH" : "NOS",
      quantity: 1,
      rate: gstRate,
      taxableValue,
      igstRate,
      cgstRate,
      sgstRate,
      cessRate: 0,
      igstAmount,
      cgstAmount,
      sgstAmount,
      cessAmount,
      totalAmount: totalInvoiceValue,
    },
  ];

  // 8. Buyer & Supplier Names
  let supplierName = "";
  let buyerName = "";

  const soldByMatch = text.match(/(?:Sold\s*By|From)\s*[:\s]*\n*([^\n\r]+)/i);
  if (soldByMatch?.[1]) supplierName = soldByMatch[1].trim();

  const billedToMatch = text.match(/(?:Issued\s*To|Billed\s*To|Goods\s*Shipped\s*to\s*:|Billing\s*Address)\s*[:\s]*\n*(?:M\/s\.?\s*)?([^\n\r]+)/i);
  if (billedToMatch?.[1]) {
    const raw = billedToMatch[1].trim();
    if (!raw.toLowerCase().includes("invoice no")) {
      buyerName = raw;
    }
  }

  // 9. Classification
  const classification = classifyInvoice({
    buyerGstin,
    supplierGstin,
    placeOfSupply: posCode,
    totalInvoiceValue,
    isCreditDebitNote: /credit\s*note/i.test(text),
    isExport: /export/i.test(text),
  });

  const confidenceScore =
    (invoiceNumber ? 25 : 0) +
    (invoiceDate ? 25 : 0) +
    (taxableValue > 0 ? 25 : 0) +
    (posCode ? 25 : 0);

  if (!invoiceNumber) notes.push("Invoice number could not be detected with 100% confidence");
  if (!buyerGstin && classification === "B2B") notes.push("Buyer GSTIN required for B2B");

  return {
    id: crypto.randomUUID(),
    fileName,
    fileSizeBytes,
    pageCount,
    invoiceNumber: invoiceNumber || `PDF-${fileName.replace(/\.pdf$/i, "").slice(-12)}`,
    invoiceDate,
    classification,
    documentType: /credit\s*note/i.test(text) ? "Credit Note" : "Invoice",
    supplierName: supplierName || "Supplier",
    supplierGstin,
    buyerName: buyerName || (classification === "B2B" ? "Registered Buyer" : "Consumer"),
    buyerGstin,
    placeOfSupply: posCode,
    placeOfSupplyStateName: posName || posCode,
    reverseCharge: false,
    taxableValue,
    igstAmount,
    cgstAmount,
    sgstAmount,
    cessAmount,
    totalTaxAmount,
    totalInvoiceValue,
    gstRate,
    lineItems,
    rawText: text,
    confidenceScore,
    notes,
  };
}
