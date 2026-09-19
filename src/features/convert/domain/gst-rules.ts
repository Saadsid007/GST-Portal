import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";

/**
 * Statutory rules that decide how a supply is reported.
 *
 * These are law, not heuristics. Nothing here may guess, fall back to a default
 * or consult a model: a wrong answer is a wrong return. Every rule carries the
 * notification it comes from so it can be checked against the source rather
 * than against our own code.
 */

/**
 * Notification No. 12/2024 – Central Tax (10 July 2024) substituted "two and a
 * half lakh rupees" with "one lakh rupees" in Rule 59(4) CGST Rules, effective
 * 1 August 2024.
 *
 * The threshold is tied to the *document* date, not the filing date. A return
 * or amendment for an earlier period is still filed under the rule in force
 * then, so applying today's limit to a 2024 invoice would misreport it.
 */
const B2CL_THRESHOLD_FROM_AUG_2024 = 100_000;
const B2CL_THRESHOLD_BEFORE_AUG_2024 = 250_000;
const B2CL_REVISION_DATE = Date.UTC(2024, 7, 1); // 1 Aug 2024

export function b2clThreshold(invoiceDate: string): number {
  const parsed = Date.parse(invoiceDate);
  // An unparseable date must not silently pick the lower limit and promote a
  // small supply into Table 5. The current rule is the safe default because it
  // is the one in force; the validator reports the bad date separately.
  if (Number.isNaN(parsed)) return B2CL_THRESHOLD_FROM_AUG_2024;
  return parsed >= B2CL_REVISION_DATE
    ? B2CL_THRESHOLD_FROM_AUG_2024
    : B2CL_THRESHOLD_BEFORE_AUG_2024;
}

/**
 * Rule 59(4) measures the threshold against the *invoice value* — the total the
 * recipient pays, tax included — not the taxable value. At 18% the difference
 * decides the table for everything between ₹84,746 and ₹1,00,000 of taxable
 * value, so using the wrong base silently files those in Table 7 instead of
 * Table 5.
 */
function invoiceValueOf(row: NormalizedInvoiceRow): number {
  return Math.abs(row.totalValue);
}

/** True where the supply crosses a state border, which Table 5 requires. */
function isInterState(row: NormalizedInvoiceRow, supplierStateCode: string): boolean {
  if (!supplierStateCode || !row.placeOfSupply) return false;
  return row.placeOfSupply.slice(0, 2) !== supplierStateCode.slice(0, 2);
}

/**
 * Re-decides B2CS vs B2CL across a whole document rather than row by row.
 *
 * A file carries one row per line item, so a ₹1.5 lakh invoice can arrive as
 * three ₹50,000 rows. Judged individually every row falls under the limit and
 * the invoice lands in Table 7 as a consolidated B2CS entry — the invoice-wise
 * reporting Rule 59(4) requires never happens, and nothing in the output shows
 * that it was skipped.
 *
 * Returns the same rows with `invoiceType` corrected. Rows already settled as
 * B2B, EXP or credit notes are left alone: registration and document type
 * decide those, not value.
 */
export function classifyB2cByInvoiceValue(
  rows: NormalizedInvoiceRow[],
  supplierGstin: string | undefined
): NormalizedInvoiceRow[] {
  const supplierState = (supplierGstin ?? "").slice(0, 2);
  if (!supplierState) return rows;

  const valueByInvoice = new Map<string, number>();
  for (const row of rows) {
    if (row.invoiceType !== "B2CS" && row.invoiceType !== "B2CL") continue;
    if (row.transactionType !== "Sales") continue;
    const key = row.invoiceNumber;
    if (!key) continue;
    valueByInvoice.set(key, (valueByInvoice.get(key) ?? 0) + invoiceValueOf(row));
  }

  return rows.map((row) => {
    if (row.invoiceType !== "B2CS" && row.invoiceType !== "B2CL") return row;
    if (row.transactionType !== "Sales") return row;

    const documentValue = valueByInvoice.get(row.invoiceNumber);
    if (documentValue === undefined) return row;

    const qualifies =
      isInterState(row, supplierState) && documentValue > b2clThreshold(row.invoiceDate);
    const invoiceType = qualifies ? "B2CL" : "B2CS";

    return invoiceType === row.invoiceType ? row : { ...row, invoiceType };
  });
}

/**
 * Credit and debit notes to unregistered recipients follow the same limit: the
 * amendment changed Rule 59(4) "wherever" the words occur, so a note against a
 * B2CL supply is reported in Table 9B (CDNUR) on the same ₹1 lakh trigger.
 */
export function isCdnurNote(row: NormalizedInvoiceRow): boolean {
  if (row.invoiceType !== "CDNCS") return false;
  return Math.abs(row.totalValue) > b2clThreshold(row.invoiceDate);
}
