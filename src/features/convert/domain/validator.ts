/**
 * Invoice Validator — runs all GSTR-1 compliance checks on parsed rows.
 */

import { STATE_CODES } from "./state-codes";
import { isStockTransferRow, isReportableTransfer } from "./stock-transfer";
import {
  suggestHsn,
  type SuggestedHsn,
} from "@/features/convert/engine/error-center/hsn-suggester";
import {
  isConfidentSuggestion,
  suggestGstRate,
} from "@/features/convert/engine/error-center/rate-suggester";
import type { NormalizedInvoiceRow, ValidationIssue } from "@/features/convert/types/convert.types";

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[0-9A-Z]{1}[0-9A-Z]{1}$/;

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const GSTIN_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * The check digit the first fourteen characters of a GSTIN imply.
 *
 * A GSTIN carries its own checksum, so a mistyped one is recognisable without
 * asking the portal. The format alone is not enough: a seller's own invoice
 * template had "24ABQPM0946Q1ZJ" where the buyer's registration is
 * "24AQBPM0946Q1ZJ" — two letters transposed, the right shape, and a
 * different business. Filed that way the buyer cannot claim the credit and
 * the seller answers a mismatch notice months later.
 */
function gstinCheckDigit(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const value = GSTIN_ALPHABET.indexOf(first14[i]!);
    if (value < 0) return "";
    const product = value * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return GSTIN_ALPHABET[(36 - (sum % 36)) % 36] ?? "";
}

export function isValidGstin(gstin: string): boolean {
  if (!GSTIN_REGEX.test(gstin)) return false;
  return gstinCheckDigit(gstin.slice(0, 14)) === gstin[14];
}

function checkGstin(gstin: string): boolean {
  if (!gstin) return true; // Empty GSTIN is valid for B2CS
  return isValidGstin(gstin);
}

/** Characters a hand-typed GSTIN confuses: I for 1, O for 0, S for 5… */
const LOOKALIKES: Record<string, string> = {
  I: "1",
  L: "1",
  "1": "I",
  O: "0",
  D: "0",
  Q: "0",
  "0": "O",
  S: "5",
  "5": "S",
  B: "8",
  "8": "B",
  Z: "2",
  "2": "Z",
  G: "6",
  "6": "G",
};

/**
 * The one registration a mistyped GSTIN most likely meant.
 *
 * Bills typed by hand read "09AFXPK9825PIZ4" for "…P1Z4" and "09EMOPR4227N1ZS"
 * for "…N1Z5"; the accountant corrects them from memory. The checksum makes the
 * correction checkable. Look-alike swaps are tried first, the commoner slip;
 * neighbours switched round only when no swap works. Any checksum passes by
 * chance one time in 36, so a candidate must also be a real registration's
 * shape — the fourth letter of the PAN names the kind of holder — and a
 * suggestion is made only when exactly one survives: never a guess between two.
 */
export function suggestGstinCorrection(gstin: string): string | null {
  const typed = gstin.toUpperCase();
  if (typed.length !== 15) return null;

  const plausible = (candidate: string) =>
    isValidGstin(candidate) && PAN_HOLDER_TYPES.includes(candidate[5]!) && candidate[13] === "Z";
  const unique = (candidates: Set<string>) => {
    const valid = [...candidates].filter(plausible);
    return valid.length === 1 ? valid[0]! : valid.length > 1 ? "" : null;
  };

  const swaps = new Set<string>();
  const transpositions = new Set<string>();
  for (let i = 0; i < 15; i++) {
    const swap = LOOKALIKES[typed[i]!];
    if (swap) swaps.add(typed.slice(0, i) + swap + typed.slice(i + 1));
    if (i < 14 && typed[i] !== typed[i + 1])
      transpositions.add(typed.slice(0, i) + typed[i + 1] + typed[i] + typed.slice(i + 2));
  }

  const bySwap = unique(swaps);
  if (bySwap !== null) return bySwap || null;
  return unique(transpositions) || null;
}

/** Individual, company, HUF, firm, AOP, trust, BOI, local authority, AJP, government. */
const PAN_HOLDER_TYPES = "PCHFATBLJG";

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
    // A cancelled invoice has no value, rate or place of supply to check — it
    // is a number accounted for in Table 13 and nothing else. Validating it
    // like a supply turned every cancellation into an error.
    if (row.documentOnly) {
      return { ...row, errors: [], reviews: [] };
    }

    const errors: string[] = [];
    const reviews: string[] = [];
    let hsnSuggestion: SuggestedHsn | null = null;

    const isB2C = row.invoiceType === "B2CS" || row.invoiceType === "CDNCS" || !row.buyerGstin;

    // VAL-001: Mandatory fields
    if (!isB2C && !row.invoiceNumber?.trim()) errors.push("Invoice number is required");
    if (!isB2C && !row.invoiceDate) errors.push("Invoice date is required");
    if (!isB2C && !row.buyerName?.trim()) errors.push("Buyer name is required");
    if (row.taxableValue === 0) errors.push("Taxable value cannot be zero");

    // VAL-002: GSTIN format
    if (row.buyerGstin && !checkGstin(row.buyerGstin)) {
      const likely = suggestGstinCorrection(row.buyerGstin);
      errors.push(
        (GSTIN_REGEX.test(row.buyerGstin)
          ? `GSTIN ${row.buyerGstin} fails its own check digit — one character is wrong`
          : `Invalid GSTIN format: ${row.buyerGstin}`) +
          (likely ? ` — probably ${likely}, the only valid GSTIN one typing slip away` : "")
      );
    }

    // VAL-002b: A business does not supply itself. The buyer's GSTIN being the
    // seller's own is a purchase bill in the pile — a supplier's invoice to
    // this business — and reported here it declared someone else's sale as
    // this seller's turnover.
    if (
      row.buyerGstin &&
      supplierGstin &&
      row.buyerGstin.toUpperCase() === supplierGstin.toUpperCase()
    ) {
      errors.push(
        "The buyer's GSTIN is your own: this is a bill you received, not a sale you made. GSTR-1 reports only your sales — remove it."
      );
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
    // An untaxed movement of the seller's own stock is held out of every table
    // of the return, so a missing HSN on one blocks a filing it was never part
    // of. Amazon's transfer feed carries no HSN at all, which turned a single
    // upload into errors the user could do nothing about and had no reason to.
    // It stays visible as a review item rather than disappearing.
    //
    // A transfer that does carry tax is a supply and is reported, so it needs
    // its code like any other B2B row.
    const isTransfer =
      isStockTransferRow(row, supplierGstin ?? "") &&
      !isReportableTransfer(row, supplierGstin ?? "");
    if (!isB2C) {
      if (!row.hsnCode?.trim()) {
        if (isTransfer) {
          reviews.push("No HSN code — not needed, this moves your own stock between your GSTINs");
        } else {
          // Still an error: a code the seller has not declared is not one we
          // can file. But where the upload evidences it, the fix is one click
          // rather than a retyped code — see `hsnSuggestion` below.
          hsnSuggestion = suggestHsn(row, rows);
          errors.push(
            hsnSuggestion
              ? `HSN/SAC code is required — ${hsnSuggestion.code} suggested, ${hsnSuggestion.reason}`
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
      suggestedHsnCode: hsnSuggestion ?? undefined,
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
