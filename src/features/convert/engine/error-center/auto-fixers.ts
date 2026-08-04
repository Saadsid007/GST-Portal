import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";
import {
  transformGstin,
  transformStateCode,
  transformHsn,
} from "@/features/convert/engine/transformation/transformers";

export interface AutoFixSummary {
  gstinFixedCount: number;
  posFixedCount: number;
  hsnFixedCount: number;
  taxFixedCount: number;
  totalFixed: number;
}

/**
 * Auto-Fix Utilities — Allows users to fix common data errors (e.g. spaces in GSTIN, missing POS, raw HSN)
 * in one click without editing the Excel file.
 */
export function applyAutoFixers(
  rows: NormalizedInvoiceRow[],
  supplierGstin: string
): { rows: NormalizedInvoiceRow[]; summary: AutoFixSummary } {
  let gstinFixedCount = 0;
  let posFixedCount = 0;
  let hsnFixedCount = 0;
  let taxFixedCount = 0;

  const fixedRows = rows.map((row) => {
    let buyerGstin = row.buyerGstin;
    let pos = row.placeOfSupply;
    let hsnCode = row.hsnCode;
    let cgstAmount = row.cgstAmount;
    let sgstAmount = row.sgstAmount;
    let igstAmount = row.igstAmount;

    // 1. Auto-Fix GSTIN
    const cleanedGstin = transformGstin(buyerGstin);
    if (cleanedGstin !== buyerGstin) {
      buyerGstin = cleanedGstin;
      gstinFixedCount++;
    }

    // 2. Auto-Fix POS from GSTIN prefix
    if (!pos && buyerGstin.length >= 2) {
      const derivedPos = transformStateCode("", buyerGstin);
      if (derivedPos) {
        pos = derivedPos;
        posFixedCount++;
      }
    }

    // 3. Auto-Fix HSN Code
    const cleanedHsn = transformHsn(hsnCode);
    if (cleanedHsn !== hsnCode) {
      hsnCode = cleanedHsn;
      hsnFixedCount++;
    }

    // 4. Auto-Fix missing tax amounts for inter/intra state
    const supplierState = supplierGstin ? supplierGstin.substring(0, 2) : "";
    const isInterState = supplierState !== "" && pos !== "" && supplierState !== pos;

    if (isInterState && (cgstAmount > 0 || sgstAmount > 0)) {
      igstAmount = Math.round((cgstAmount + sgstAmount) * 100) / 100;
      cgstAmount = 0;
      sgstAmount = 0;
      taxFixedCount++;
    } else if (!isInterState && igstAmount > 0) {
      const half = Math.round((igstAmount / 2) * 100) / 100;
      cgstAmount = half;
      sgstAmount = half;
      igstAmount = 0;
      taxFixedCount++;
    }

    return {
      ...row,
      buyerGstin,
      placeOfSupply: pos,
      hsnCode,
      cgstAmount,
      sgstAmount,
      igstAmount,
    };
  });

  const totalFixed = gstinFixedCount + posFixedCount + hsnFixedCount + taxFixedCount;

  return {
    rows: fixedRows,
    summary: {
      gstinFixedCount,
      posFixedCount,
      hsnFixedCount,
      taxFixedCount,
      totalFixed,
    },
  };
}
