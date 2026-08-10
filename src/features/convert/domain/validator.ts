/**
 * Invoice Validator — runs all GSTR-1 compliance checks on parsed rows.
 */

import { STATE_CODES } from "./state-codes";
import {
  isConfidentSuggestion,
  suggestGstRate,
} from "@/features/convert/engine/error-center/rate-suggester";
import type { NormalizedInvoiceRow, ValidationIssue } from "@/features/convert/types/convert.types";

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[0-9A-Z]{1}[0-9A-Z]{1}$/;

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function checkGstin(gstin: string): boolean {
  if (!gstin) return true; // Empty GSTIN is valid for B2CS
  return GSTIN_REGEX.test(gstin);
}

function checkTaxMath(row: NormalizedInvoiceRow): string[] {
  const errors: string[] = [];
  const tolerance = 2; // ₹2 tolerance for rounding

  const absTaxable = Math.abs(row.taxableValue);
  const expectedCgst = round2(absTaxable * (row.cgstRate / 100));
  const expectedSgst = round2(absTaxable * (row.sgstRate / 100));
  const expectedIgst = round2(absTaxable * (row.igstRate / 100));

  const absCgst = Math.abs(row.cgstAmount);
  const absSgst = Math.abs(row.sgstAmount);
  const absIgst = Math.abs(row.igstAmount);

  if (row.cgstRate > 0 && Math.abs(absCgst - expectedCgst) > tolerance) {
    errors.push(`CGST mismatch: expected ₹${expectedCgst}, got ₹${absCgst}`);
  }
  if (row.sgstRate > 0 && Math.abs(absSgst - expectedSgst) > tolerance) {
    errors.push(`SGST mismatch: expected ₹${expectedSgst}, got ₹${absSgst}`);
  }
  if (row.igstRate > 0 && Math.abs(absIgst - expectedIgst) > tolerance) {
    errors.push(`IGST mismatch: expected ₹${expectedIgst}, got ₹${absIgst}`);
  }

  return errors;
}

export function validateInvoices(
  rows: NormalizedInvoiceRow[],
  supplierGstin: string
): {
  rows: NormalizedInvoiceRow[];
  issues: ValidationIssue[];
  validCount: number;
  errorCount: number;
  reviewCount: number;
} {
  const supplierState = supplierGstin ? supplierGstin.substring(0, 2) : "";
  const seenInvoices = new Map<string, number>();
  const issues: ValidationIssue[] = [];

  const validated = rows.map((row) => {
    const errors: string[] = [];
    const reviews: string[] = [];

    // VAL-001: Mandatory fields
    if (!row.invoiceNumber?.trim()) errors.push("Invoice number is required");
    if (!row.invoiceDate) errors.push("Invoice date is required");
    if (!row.buyerName?.trim()) errors.push("Buyer name is required");
    if (row.taxableValue === 0) errors.push("Taxable value cannot be zero");

    // VAL-002: GSTIN format
    if (row.buyerGstin && !checkGstin(row.buyerGstin)) {
      errors.push(`Invalid GSTIN format: ${row.buyerGstin}`);
    }

    // VAL-003: Invoice number length
    if (row.invoiceNumber && row.invoiceNumber.length > 16) {
      errors.push(`Invoice number exceeds 16 characters: "${row.invoiceNumber}"`);
    }

    // VAL-004: Place of supply
    if (!row.placeOfSupply) {
      errors.push("Place of supply is required");
    } else if (!STATE_CODES[row.placeOfSupply]) {
      errors.push(`Invalid state code: "${row.placeOfSupply}"`);
    }

    // VAL-005: HSN code format
    if (!row.hsnCode?.trim()) {
      errors.push("HSN/SAC code is required");
    } else if (!/^\d{4}(\d{2}(\d{2})?)?$/.test(row.hsnCode.replace(/\s/g, ""))) {
      errors.push(`Invalid HSN code: "${row.hsnCode}" (must be 4, 6, or 8 digits)`);
    }

    // VAL-006: Tax calculation
    const taxErrors = checkTaxMath(row);
    errors.push(...taxErrors);

    // VAL-009: No usable rate on the row itself. Before failing it, try to infer the rate from
    // rows that share its HSN or item description. A confident inference is a review item with a
    // one-click Apply, not an error — the user still confirms, but is not made to retype a rate
    // the upload already evidences. A weak or absent inference stays a hard error, because
    // filing a guessed slab is worse than filing late.
    let suggestion: ReturnType<typeof suggestGstRate> = null;
    if (row.cgstRate === 0 && row.sgstRate === 0 && row.igstRate === 0) {
      suggestion = suggestGstRate(row, rows);
      if (isConfidentSuggestion(suggestion)) {
        reviews.push(
          `GST rate inferred as ${suggestion.rate}% (${suggestion.confidence}% confidence) — ${suggestion.reason}`
        );
      } else {
        suggestion = null;
        errors.push("GST rate could not be determined — enter the rate for this row");
      }
    }

    // VAL-007: Inter-state vs intra-state tax type
    if (row.placeOfSupply && supplierState) {
      const isInterState = supplierState !== row.placeOfSupply;
      if (isInterState && (row.cgstAmount > 0 || row.sgstAmount > 0)) {
        errors.push("Inter-state supply should use IGST, not CGST/SGST");
      }
      if (!isInterState && row.igstAmount > 0) {
        errors.push("Intra-state supply should use CGST+SGST, not IGST");
      }
    }

    // VAL-008: Duplicate invoice detection
    // Only check B2B and CDNR invoices. B2CS supplies are aggregated by POS + rate.
    // Scoped by invoiceType + invoiceNumber + hsnCode + rate so distinct line items for the
    // same invoice (e.g. product HSN 441900 vs freight HSN 998313) are recognized as valid.
    if (row.invoiceType === "B2B" || row.invoiceType === "CDNR") {
      const dupeKey = row.invoiceNumber?.trim().toLowerCase();
      if (dupeKey) {
        const rate = row.igstRate > 0 ? row.igstRate : row.cgstRate + row.sgstRate;
        const scopedKey = `${row.invoiceType}::${dupeKey}::${row.hsnCode || "NOHSN"}::${rate}`;
        if (seenInvoices.has(scopedKey)) {
          const platformNote = row.sourcePlatformName ? ` in ${row.sourcePlatformName}` : "";
          errors.push(
            `Duplicate invoice number${platformNote} (also at row ${seenInvoices.get(scopedKey)})`
          );
        } else {
          seenInvoices.set(scopedKey, row.rowIndex);
        }
      }
    }

    // Collect issues for summary
    errors.forEach((msg) => {
      issues.push({
        rowId: row.id,
        rowIndex: row.rowIndex,
        field: "general",
        message: msg,
        severity: "ERROR",
      });
    });

    reviews.forEach((msg) => {
      issues.push({
        rowId: row.id,
        rowIndex: row.rowIndex,
        field: "gstRate",
        message: msg,
        severity: "REVIEW",
      });
    });

    // A marketplace supply without an operator GSTIN cannot be reported under Table 14(a).
    // That is a gap in the source export, not a reason to reject an otherwise valid invoice.
    if (!row.ecoGstin && row.sourcePlatformId && row.sourcePlatformId !== "custom") {
      issues.push({
        rowId: row.id,
        rowIndex: row.rowIndex,
        field: "ecoGstin",
        message: `No e-commerce operator GSTIN for the ${row.sourcePlatformName ?? row.sourcePlatformId} export — set it on the Marketplaces step or this supply will not appear in Table 14`,
        severity: "WARNING",
      });
    }

    return {
      ...row,
      errors,
      reviews,
      // Always written, never conditionally spread: a row revalidated after its rate was set
      // has no suggestion, and leaving the previous pass's value in place kept it counted as
      // still-inferred long after it was resolved.
      suggestedGstRate: suggestion
        ? {
            rate: suggestion.rate,
            confidence: suggestion.confidence,
            sampleSize: suggestion.sampleSize,
            source: suggestion.source,
            reason: suggestion.reason,
          }
        : undefined,
    };
  });

  const validCount = validated.filter((r) => r.errors.length === 0).length;
  const errorCount = validated.filter((r) => r.errors.length > 0).length;
  const reviewCount = validated.filter((r) => r.errors.length === 0 && r.reviews.length > 0).length;

  return { rows: validated, issues, validCount, errorCount, reviewCount };
}
