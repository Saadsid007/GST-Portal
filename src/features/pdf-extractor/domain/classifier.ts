import type { InvoiceClassification } from "./types";
import { normalizeStateCode } from "@/features/convert/domain/state-codes";

export function classifyInvoice(params: {
  buyerGstin?: string;
  supplierGstin?: string;
  placeOfSupply?: string;
  totalInvoiceValue: number;
  isCreditDebitNote?: boolean;
  isExport?: boolean;
}): InvoiceClassification {
  const {
    buyerGstin = "",
    supplierGstin = "",
    placeOfSupply = "",
    totalInvoiceValue,
    isCreditDebitNote = false,
    isExport = false,
  } = params;

  if (isExport) {
    return "EXP";
  }

  const cleanBuyerGstin = buyerGstin.trim().toUpperCase();
  const hasValidBuyerGstin = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(
    cleanBuyerGstin
  );

  if (isCreditDebitNote) {
    return hasValidBuyerGstin ? "CDNR" : "CDNUR";
  }

  if (hasValidBuyerGstin) {
    return "B2B";
  }

  // Unregistered buyer classification
  const supplierState = supplierGstin ? supplierGstin.slice(0, 2) : "";
  const posState = normalizeStateCode(placeOfSupply);
  const isInterState = Boolean(supplierState && posState && supplierState !== posState);

  // Post-2024 GST Notification threshold: > ₹1,00,000 for B2CL
  if (isInterState && totalInvoiceValue > 100000) {
    return "B2CL";
  }

  return "B2CS";
}
