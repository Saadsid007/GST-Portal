/**
 * Invoice Validator — runs all GSTR-1 compliance checks on parsed rows.
 */

import { STATE_CODES } from "./state-codes";
import { isStockTransferRow } from "./stock-transfer";
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

/** Minimum share before one code is worth naming as what this seller deals in. */
const DOMINANT_HSN_SHARE = 80;

/**
 * The HSN the upload overwhelmingly uses, if there is one.
 *
 * Returns null when the seller deals in several commodities — there the code
 * on one row says nothing about the code on another, and naming any of them
 * would point the user at the wrong answer.
 */
function dominantHsn(rows: NormalizedInvoiceRow[]): { code: string; share: number } | null {
  const counts = new Map<string, number>();
  for (const row of rows) {
    // The 4-digit heading and its 6-digit form are one commodity, not two.
    const code = (row.hsnCode ?? "").replace(/\D/g, "");
    if (code.length < 4) continue;
    const key = code.length === 4 ? `${code}00` : code;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
  if (total === 0) return null;

  const [best] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (!best) return null;

  const share = Math.round((best[1] / total) * 100);
  return share >= DOMINANT_HSN_SHARE ? { code: best[0], share } : null;
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

  // What the rest of this upload classifies its goods as. A seller who deals
  // in one commodity has it on hundreds of rows, and a marketplace export
  // that omits the code on four of them is not asking a new question. This is
  // shown with the error, never applied: it is the user's declaration, and a
  // code we chose for them would be a guess wearing a number.
  const commonHsn = dominantHsn(rows);

  const validated = rows.map((row) => {
    const errors: string[] = [];
    const reviews: string[] = [];

    const isB2C = row.invoiceType === "B2CS" || row.invoiceType === "CDNCS" || !row.buyerGstin;

    // VAL-001: Mandatory fields
    if (!isB2C && !row.invoiceNumber?.trim()) errors.push("Invoice number is required");
    if (!isB2C && !row.invoiceDate) errors.push("Invoice date is required");
    if (!isB2C && !row.buyerName?.trim()) errors.push("Buyer name is required");
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

    // VAL-005: HSN code format (Mandatory for B2B, optional for B2C)
    //
    // A movement of the seller's own stock is held out of every table of the
    // return, so a missing HSN on one blocks a filing it was never part of.
    // Amazon's transfer feed carries no HSN at all, which turned a single
    // upload into ten errors the user could do nothing about and had no
    // reason to. It stays visible as a review item rather than disappearing:
    // if these are later reported as supplies, the code is needed.
    const isTransfer = isStockTransferRow(row, supplierGstin ?? "");
    if (!isB2C) {
      if (!row.hsnCode?.trim()) {
        if (isTransfer) {
          reviews.push("No HSN code — not needed, this moves your own stock between your GSTINs");
        } else {
          errors.push(
            commonHsn
              ? `HSN/SAC code is required — ${commonHsn.share}% of this upload uses ${commonHsn.code}`
              : "HSN/SAC code is required"
          );
        }
      } else if (!/^\d{4}(\d{2}(\d{2})?)?$/.test(row.hsnCode.replace(/\s/g, ""))) {
        errors.push(`Invalid HSN code: "${row.hsnCode}" (must be 4, 6, or 8 digits)`);
      }
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
