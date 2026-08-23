/**
 * GSTIN slot accounting.
 *
 * A slot is consumed by a *GSTIN number*, not by a profile row. Two rules fall
 * out of that, and both matter for revenue integrity:
 *
 *  1. Deleting a profile does not refund the slot for the rest of the billing
 *     period. Otherwise a ₹79 Starter plan (10 GSTINs) could be cycled through
 *     an unlimited number of clients in one month by deleting after each
 *     filing — the plan limit would mean nothing.
 *
 *  2. Re-adding a GSTIN that already consumed a slot this period is free. The
 *     user already paid for that number; charging twice for an accidental
 *     delete would be punitive.
 *
 * Pure functions only — the caller supplies the two lists. Kept free of Prisma
 * so the arithmetic is testable without a database.
 */

/** Uppercases and trims so casing differences never split one GSTIN into two slots. */
export function normalizeGstin(gstin: string): string {
  return gstin.trim().toUpperCase();
}

export interface GstinSlotUsageInput {
  /** GSTINs of profiles that exist right now, regardless of when they were created. */
  activeGstins: string[];
  /** GSTINs recorded in the creation ledger since the current period started, including deleted ones. */
  periodGstins: string[];
}

export interface GstinSlotUsage {
  /** Slots counted against the plan limit: active profiles ∪ this period's creations. */
  consumed: number;
  /** Distinct GSTINs with a live profile. */
  activeCount: number;
  /** Slots still held by GSTINs deleted during this period. Released at renewal. */
  retainedCount: number;
  /** The deleted-but-still-billed GSTINs, for support and audit answers. */
  retainedGstins: string[];
}

/**
 * Counts the slots a workspace has consumed in the current billing period.
 *
 * Active profiles always count, even when created in an earlier period — they
 * are occupying capacity today. This period's ledger entries also count, which
 * is what keeps a deleted profile billed until renewal.
 */
export function computeGstinSlotUsage(input: GstinSlotUsageInput): GstinSlotUsage {
  const active = new Set(input.activeGstins.map(normalizeGstin));
  const period = new Set(input.periodGstins.map(normalizeGstin));

  const retainedGstins = [...period].filter((g) => !active.has(g)).sort();
  const consumed = new Set([...active, ...period]).size;

  return {
    consumed,
    activeCount: active.size,
    retainedCount: retainedGstins.length,
    retainedGstins,
  };
}

/**
 * Whether deleting `gstin` frees a slot immediately.
 *
 * It frees one only when the GSTIN was first added in an earlier period: its
 * slot was never charged against *this* period's ledger. Anything added during
 * the current period stays counted until renewal.
 */
export function isSlotRetainedOnDelete(input: {
  gstin: string;
  periodGstins: string[];
  /** GSTINs of the workspace's other live profiles — a duplicate keeps the slot in use. */
  otherActiveGstins: string[];
}): boolean {
  const target = normalizeGstin(input.gstin);
  const stillActiveElsewhere = input.otherActiveGstins.map(normalizeGstin).includes(target);
  if (stillActiveElsewhere) return false;

  return input.periodGstins.map(normalizeGstin).includes(target);
}
