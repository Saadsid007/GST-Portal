import type { NormalizedInvoiceRow } from "@/features/convert/types/convert.types";

/**
 * A row whose rate is inferred at or above this confidence is routed to "Needs Review"
 * with a one-click Apply, instead of being failed outright. Below it, the data does not
 * justify a suggestion and the user must supply the rate.
 */
export const RATE_CONFIDENCE_THRESHOLD = 95;

export type RateSuggestionSource = "HSN" | "DESCRIPTION";

export interface RateSuggestion {
  rate: number;
  /** Observed agreement among matching rows, discounted for small samples. */
  confidence: number;
  /** How many other rows the suggestion was drawn from. */
  sampleSize: number;
  source: RateSuggestionSource;
  reason: string;
}

/**
 * Unanimity across two rows is not the same evidence as unanimity across twenty, but raw
 * agreement scores both at 100%. These ceilings keep a thin sample below the auto-apply
 * threshold so a single stray peer can never silently set the rate on a whole return.
 */
const SMALL_SAMPLE_CEILING: Record<number, number> = { 1: 80, 2: 92, 3: 96 };

/** Description matching is a weaker signal than a shared HSN, so it is capped lower. */
const DESCRIPTION_CEILING = 96;

function effectiveRate(row: NormalizedInvoiceRow): number {
  return row.igstRate > 0 ? row.igstRate : row.cgstRate + row.sgstRate;
}

function normalizeDescription(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

interface Consensus {
  rate: number;
  hits: number;
  distinctRates: number;
}

function consensusOf(peers: NormalizedInvoiceRow[]): Consensus | null {
  const counts = new Map<number, number>();
  for (const peer of peers) {
    const rate = effectiveRate(peer);
    counts.set(rate, (counts.get(rate) ?? 0) + 1);
  }
  const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
  if (!top) return null;
  return { rate: top[0], hits: top[1], distinctRates: counts.size };
}

function scoreConfidence(hits: number, sampleSize: number, ceiling: number): number {
  const agreement = Math.round((hits / sampleSize) * 100);
  const sampleCeiling = SMALL_SAMPLE_CEILING[sampleSize] ?? 100;
  return Math.min(agreement, sampleCeiling, ceiling);
}

/**
 * Suggests the GST rate for a row that has none, using rates the same HSN — or failing that,
 * the same item description — already carries elsewhere in the uploaded data.
 *
 * Confidence is evidence about this dataset, not a model score: it is the observed agreement
 * among matching rows, held down when there are too few of them to mean much.
 *
 * Returns null when the data gives no basis for a suggestion, so the caller falls back to
 * asking the user rather than guessing a slab.
 */
export function suggestGstRate(
  row: NormalizedInvoiceRow,
  allRows: NormalizedInvoiceRow[]
): RateSuggestion | null {
  if (effectiveRate(row) > 0) return null;

  const rated = allRows.filter((r) => r.id !== row.id && effectiveRate(r) > 0);

  if (row.hsnCode) {
    const peers = rated.filter((r) => r.hsnCode === row.hsnCode);
    const consensus = consensusOf(peers);
    if (consensus) {
      return {
        rate: consensus.rate,
        confidence: scoreConfidence(consensus.hits, peers.length, 100),
        sampleSize: peers.length,
        source: "HSN",
        reason:
          consensus.distinctRates === 1
            ? `All ${peers.length} other row(s) with HSN ${row.hsnCode} use ${consensus.rate}%`
            : `${consensus.hits} of ${peers.length} row(s) with HSN ${row.hsnCode} use ${consensus.rate}%`,
      };
    }
  }

  const description = normalizeDescription(row.itemDescription);
  if (description) {
    const peers = rated.filter((r) => normalizeDescription(r.itemDescription) === description);
    const consensus = consensusOf(peers);
    if (consensus) {
      return {
        rate: consensus.rate,
        confidence: scoreConfidence(consensus.hits, peers.length, DESCRIPTION_CEILING),
        sampleSize: peers.length,
        source: "DESCRIPTION",
        reason: `${consensus.hits} of ${peers.length} row(s) for "${row.itemDescription}" use ${consensus.rate}%`,
      };
    }
  }

  return null;
}

/** True when the suggestion is strong enough to downgrade the row from Error to Needs Review. */
export function isConfidentSuggestion(
  suggestion: RateSuggestion | null
): suggestion is RateSuggestion {
  return suggestion !== null && suggestion.confidence >= RATE_CONFIDENCE_THRESHOLD;
}
