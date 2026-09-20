import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";

/**
 * What HSN a row without one probably carries, and the evidence for it.
 *
 * Marketplace exports omit the HSN on scattered rows — Amazon's transfer feed
 * has no such column at all — and the seller then has to retype a code the
 * upload already evidences on hundreds of other rows. Nothing here is applied
 * on its own: a suggestion is shown with what it rests on, and the user
 * accepts it. The declaration stays theirs.
 */

export interface SuggestedHsn {
  code: string;
  /** How much of the coded rows in this upload agree, as a percentage. */
  share: number;
  reason: string;
}

/** Below this the upload is not speaking with one voice, and naming a code would mislead. */
const CONFIDENT_SHARE = 80;

/** The 4-digit heading and its 6-digit form are one commodity, not two. */
function canonical(hsnCode: string | undefined): string {
  const digits = (hsnCode ?? "").replace(/\D/g, "");
  if (digits.length < 4) return "";
  return digits.length === 4 ? `${digits}00` : digits;
}

/**
 * The strongest evidence first: another row for the same product.
 *
 * An exact description match is the seller's own classification of that item,
 * which is worth more than anything the rest of the upload says.
 */
function byItemDescription(
  row: NormalizedInvoiceRow,
  rows: NormalizedInvoiceRow[]
): SuggestedHsn | null {
  const description = (row.itemDescription ?? "").trim().toLowerCase();
  if (description.length < 8) return null;

  const codes = new Set(
    rows
      .filter((other) => (other.itemDescription ?? "").trim().toLowerCase() === description)
      .map((other) => canonical(other.hsnCode))
      .filter(Boolean)
  );

  // Two codes for one product is the seller disagreeing with themselves; that
  // is theirs to resolve, not ours to pick a side in.
  if (codes.size !== 1) return null;

  const [code] = [...codes];
  return {
    code: code!,
    share: 100,
    reason: `the same item is classified ${code} elsewhere in this upload`,
  };
}

/** Failing that, what the seller deals in — if they deal in essentially one thing. */
function byDominantCode(rows: NormalizedInvoiceRow[]): SuggestedHsn | null {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const code = canonical(row.hsnCode);
    if (code) counts.set(code, (counts.get(code) ?? 0) + 1);
  }

  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
  if (total === 0) return null;

  const [best] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (!best) return null;

  const share = Math.round((best[1] / total) * 100);
  if (share < CONFIDENT_SHARE) return null;

  return {
    code: best[0],
    share,
    reason: `${share}% of the coded rows in this upload are ${best[0]}`,
  };
}

export function suggestHsn(
  row: NormalizedInvoiceRow,
  rows: NormalizedInvoiceRow[]
): SuggestedHsn | null {
  if (row.hsnCode?.trim()) return null;
  return byItemDescription(row, rows) ?? byDominantCode(rows);
}
