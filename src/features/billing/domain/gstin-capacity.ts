/**
 * GSTIN capacity accounting — pure, database-free, exhaustively testable.
 *
 * The billing model is subscription + active GSTIN capacity. There is no
 * per-GSTR-1 charge. A plan grants a base number of ACTIVE GSTIN slots; add-ons
 * grant extra slots. Capacity is consumed by the count of ACTIVE profiles, not
 * by how many were ever created.
 *
 * Two invariants this module encodes:
 *
 *  1. Archiving frees the slot immediately, and the freed slot is reusable
 *     (restore an archived GSTIN, or activate a new one) at no extra cost. An
 *     add-on is capacity, never welded to one specific GSTIN.
 *
 *  2. The create → file → archive → create-another loop is still bounded, but
 *     by a per-cycle NEW-activation cap plus churn rate-limiting — not by
 *     freezing archives. A CA replacing a client stays smooth; someone cycling
 *     hundreds of throwaway GSTINs hits the cap and an admin-review trigger.
 */

/** Uppercase + trim so casing never splits one GSTIN identity into two. */
export function normalizeGstin(gstin: string): string {
  return gstin.trim().toUpperCase();
}

/** Explicit lifecycle. Never collapse these into one boolean. */
export const GstinStatus = {
  ACTIVE: "ACTIVE",
  ARCHIVED: "ARCHIVED",
  /** Parked at renewal because the new plan could not hold every profile. */
  INACTIVE_FOR_BILLING: "INACTIVE_FOR_BILLING",
  /** Queued for permanent deletion under the retention policy. */
  PENDING_DELETE: "PENDING_DELETE",
} as const;

export type GstinStatusValue = (typeof GstinStatus)[keyof typeof GstinStatus];

/** A status counts against capacity only while the profile is genuinely live. */
export function consumesCapacity(status: string): boolean {
  return status === GstinStatus.ACTIVE;
}

export interface CapacityInput {
  /** Plan-included slots for the current entitlement. */
  base: number;
  /** Purchased add-on slots for the current entitlement. */
  additional: number;
  /** Count of profiles in ACTIVE status. */
  activeCount: number;
  /** Count of profiles in ARCHIVED status. */
  archivedCount: number;
}

export type CapacityLevel = "OK" | "WARNING_80" | "WARNING_90" | "LIMIT_REACHED";

export interface CapacitySnapshot {
  base: number;
  additional: number;
  total: number;
  active: number;
  archived: number;
  available: number;
  usagePercent: number;
  level: CapacityLevel;
  hasFreeSlot: boolean;
}

/**
 * The canonical capacity computation. Every server check and every dashboard
 * number derives from this — never from a raw client count.
 */
export function computeCapacity(input: CapacityInput): CapacitySnapshot {
  const base = Math.max(0, Math.floor(input.base));
  const additional = Math.max(0, Math.floor(input.additional));
  const active = Math.max(0, Math.floor(input.activeCount));
  const archived = Math.max(0, Math.floor(input.archivedCount));

  const total = base + additional;
  const available = Math.max(0, total - active);
  const usagePercent = total > 0 ? Math.min(100, Math.round((active / total) * 100)) : 100;

  let level: CapacityLevel = "OK";
  if (active >= total) level = "LIMIT_REACHED";
  else if (usagePercent >= 90) level = "WARNING_90";
  else if (usagePercent >= 80) level = "WARNING_80";

  return {
    base,
    additional,
    total,
    active,
    archived,
    available,
    usagePercent,
    level,
    hasFreeSlot: available > 0,
  };
}

export interface ActivationRequest {
  /** Free slots right now (total − active). */
  available: number;
  /**
   * Distinct brand-new GSTINs already activated this billing period. Restoring
   * a GSTIN that was already activated this period does not add to this.
   */
  periodNewActivations: number;
  /** total capacity + replacement allowance — the per-cycle activation ceiling. */
  activationCeiling: number;
  /**
   * True when this activation is a restore/re-add of a GSTIN already activated
   * in the current period. It still needs a free slot, but it does not count as
   * a new activation, so an accidental archive can be undone freely.
   */
  isReactivationOfKnownGstin: boolean;
}

export type ActivationDenial = { code: "NO_CAPACITY" } | { code: "CYCLE_ACTIVATION_LIMIT" };

export type ActivationDecision = { allowed: true } | ({ allowed: false } & ActivationDenial);

/**
 * Whether a workspace may bring one more GSTIN into ACTIVE status right now.
 *
 * Two independent gates: a free capacity slot must exist, and — for a genuinely
 * new GSTIN — the per-cycle activation ceiling must not be exceeded. The ceiling
 * is what stops delete-and-recreate abuse without freezing legitimate archives.
 */
export function evaluateActivation(req: ActivationRequest): ActivationDecision {
  if (req.available <= 0) {
    return { allowed: false, code: "NO_CAPACITY" };
  }
  if (!req.isReactivationOfKnownGstin && req.periodNewActivations >= req.activationCeiling) {
    return { allowed: false, code: "CYCLE_ACTIVATION_LIMIT" };
  }
  return { allowed: true };
}

/**
 * Per-cycle activation ceiling: everything the plan can hold, plus a replacement
 * allowance so swapping clients within the period never requires an upgrade.
 */
export function activationCeiling(total: number, replacementAllowance: number): number {
  return Math.max(0, total) + Math.max(0, replacementAllowance);
}

export interface ChurnWindow {
  /** Capacity-changing ops (activate/archive/restore) in the trailing window. */
  opsInWindow: number;
  /** Configured ceiling for that window. */
  maxOpsInWindow: number;
}

/** Rapid capacity churn worth rate-limiting and flagging for admin review. */
export function isAbnormalChurn(w: ChurnWindow): boolean {
  return w.opsInWindow >= w.maxOpsInWindow;
}
