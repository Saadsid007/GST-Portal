import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";

/**
 * Table 12 — the HSN-wise summary.
 *
 * Shared by both generators. They had grown separate implementations: the
 * Excel one canonicalised the code and dropped rows that classify nothing,
 * the JSON one wrote whatever the row carried. So the same return could ship
 * an Excel that was fine and a JSON the portal refuses, with "4419" and
 * "441900" listed as two commodities and a blank code among them.
 */

/** One row of Table 12. */
export interface HsnSummaryRow {
  hsnCode: string;
  description: string;
  uqc: string;
  quantity: number;
  rate: number;
  totalValue: number;
  taxableValue: number;
  igstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  cessAmount: number;
}

export interface HsnSummary {
  b2b: HsnSummaryRow[];
  b2c: HsnSummaryRow[];
  /**
   * Rows left out because they carry no usable code, and what they are worth.
   * Surfaced so the omission is something the user is told about rather than
   * something they discover when the portal rejects the file.
   */
  unclassified: { rows: number; taxableValue: number };
}

function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Canonicalises an HSN code.
 *
 * Marketplace feeds spell one commodity several ways — "4419" on one line and
 * "441900" on the next — which splits a single HSN across two rows that then
 * disagree with the filed return. A 4-digit heading is padded to the 6-digit
 * form the rest of the file uses so both land in the same bucket.
 *
 * Returns "" for a code that classifies nothing: absent, all zeros, or too
 * short to mean anything. The portal rejects such a row outright.
 */
export function normalizeHsn(raw: string | undefined): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits || /^0+$/.test(digits)) return "";
  // 2-digit chapters are too coarse to report; 4 pads to 6, 6 and 8 stand.
  if (digits.length < 4) return "";
  if (digits.length === 4) return `${digits}00`;
  if (digits.length === 5) return `${digits}0`;
  if (digits.length === 7) return digits.slice(0, 6);
  return digits.length > 8 ? digits.slice(0, 8) : digits;
}

/**
 * One readable description per row.
 *
 * Aggregation used to concatenate every product title sharing an HSN into a
 * single cell of six titles joined by semicolons — unreadable, and long
 * enough to look like corruption. Table 12 wants the commodity, not the
 * catalogue.
 */
export function hsnDescription(raw: string | undefined): string {
  const first = String(raw ?? "")
    .split(";")[0]!
    .replace(/\s+/g, " ")
    .trim();
  return first.length > 60 ? `${first.slice(0, 57)}...` : first;
}

/**
 * Builds Table 12, split into supplies to registered and unregistered persons.
 *
 * A row whose code classifies nothing is counted in `unclassified` and left
 * out of both. Reporting it would put a line on the portal that is refused —
 * and, before the placeholder code was removed, one that quietly declared the
 * wrong commodity instead.
 */
export function buildHsnSummary(rows: NormalizedInvoiceRow[]): HsnSummary {
  const b2bAgg = new Map<string, HsnSummaryRow>();
  const b2cAgg = new Map<string, HsnSummaryRow>();
  const unclassified = { rows: 0, taxableValue: 0 };

  for (const row of rows) {
    const hsnCode = normalizeHsn(row.hsnCode);
    if (!hsnCode) {
      unclassified.rows++;
      unclassified.taxableValue = r2(unclassified.taxableValue + Math.abs(row.taxableValue));
      continue;
    }

    const isB2b = row.invoiceType === "B2B" || row.invoiceType === "CDNR";
    const target = isB2b ? b2bAgg : b2cAgg;

    const rate = r2(row.igstRate > 0 ? row.igstRate : row.cgstRate + row.sgstRate);
    const uqc = row.uqc || "PCS";
    const key = `${hsnCode}|${rate}|${uqc}`;

    const bucket =
      target.get(key) ??
      ({
        hsnCode,
        description: hsnDescription(row.itemDescription),
        uqc,
        quantity: 0,
        rate,
        totalValue: 0,
        taxableValue: 0,
        igstAmount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        cessAmount: 0,
      } satisfies HsnSummaryRow);

    // A credit note reduces the commodity's reported supply.
    const sign = row.invoiceType === "CDNR" || row.invoiceType === "CDNCS" ? -1 : 1;

    if (!bucket.description) bucket.description = hsnDescription(row.itemDescription);
    bucket.quantity = r2(bucket.quantity + row.quantity * sign);
    bucket.totalValue = r2(bucket.totalValue + Math.abs(row.totalValue) * sign);
    bucket.taxableValue = r2(bucket.taxableValue + Math.abs(row.taxableValue) * sign);
    bucket.igstAmount = r2(bucket.igstAmount + Math.abs(row.igstAmount) * sign);
    bucket.cgstAmount = r2(bucket.cgstAmount + Math.abs(row.cgstAmount) * sign);
    bucket.sgstAmount = r2(bucket.sgstAmount + Math.abs(row.sgstAmount) * sign);
    bucket.cessAmount = r2(bucket.cessAmount + Math.abs(row.cessAmount) * sign);

    target.set(key, bucket);
  }

  // Only a commodity with a positive net supply is a line of Table 12.
  //
  // Testing the absolute value let a bucket through whose returns exceeded its
  // sales for the period: it survived the filter as a negative, and the
  // generators clamp with Math.max(0, …) on the way out, so what reached the
  // return was an HSN row of all zeros. The portal rejects that.
  //
  // A commodity that nets negative is a real situation and belongs in an
  // amendment, not in this month's Table 12.
  const reportable = (list: HsnSummaryRow[]) => list.filter((r) => r.taxableValue > 0.001);

  return {
    b2b: reportable([...b2bAgg.values()]),
    b2c: reportable([...b2cAgg.values()]),
    unclassified,
  };
}
