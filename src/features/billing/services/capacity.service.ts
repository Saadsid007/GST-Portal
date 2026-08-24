/**
 * GSTIN Capacity Service for GSTPilot.
 *
 * Capacity is consumed by the count of ACTIVE GSTIN profiles. Archiving frees a
 * slot immediately and preserves all data; the slot is reusable at no cost.
 * Abuse of the create → file → archive → create loop is bounded by a per-cycle
 * new-activation ceiling and hourly churn rate-limiting, both centralized in
 * pricing.config.ts — not by freezing archives. All checks are server-side and
 * capacity-changing writes run in a transaction that re-reads the live count.
 */

import prisma from "@/lib/prisma";
import {
  ADDITIONAL_GSTIN_PRICE_MONTHLY,
  MIN_GSTIN_ADDON_PACK,
  GSTIN_ANTI_ABUSE,
} from "@/features/billing/config/pricing.config";
import { getOrCreateSubscription } from "@/features/billing/services/subscription.service";
import { billingLogger } from "@/features/billing/services/billing.logger";
import {
  computeCapacity,
  evaluateActivation,
  activationCeiling as computeActivationCeiling,
  isAbnormalChurn,
  consumesCapacity,
  GstinStatus,
} from "@/features/billing/domain/gstin-capacity";
import {
  recordNewActivation,
  countPeriodNewActivations,
  wasActivatedThisPeriod,
  countRecentCapacityOps,
  recordCapacityAudit,
  CAPACITY_AUDIT_ACTIONS,
} from "@/features/billing/services/gstin-activity.service";

export interface GSTINCapacityStatus {
  userId: string;
  /** Plan-included (base) slots. */
  included: number;
  /** Purchased add-on slots. */
  additional: number;
  /** base + additional. */
  totalCapacity: number;
  /** Slots consumed = count of ACTIVE profiles. */
  used: number;
  available: number;
  usagePercent: number;
  status: "OK" | "WARNING_80" | "WARNING_90" | "LIMIT_REACHED";
  canAddMore: boolean;
  planName: string;
  planSlug: string;
  /** Count of ACTIVE profiles (same as `used`, named for the dashboard). */
  activeProfiles: number;
  /** Count of ARCHIVED profiles that can be restored into a free slot. */
  archivedProfiles: number;
  periodStart: Date;
  periodEnd: Date;
  /** Distinct brand-new GSTINs activated this period (anti-abuse visibility). */
  periodNewActivations: number;
  /** Per-cycle ceiling on brand-new activations. */
  activationCeiling: number;
}

export interface ProrationCalculation {
  quantity: number;
  pricePerGSTIN: number;
  fullMonthlyAmount: number;
  proratedAmount: number;
  remainingDays: number;
  totalCycleDays: number;
  cycleEndDate: Date;
}

/** Live counts of profiles by capacity relevance. */
async function countProfiles(
  userId: string,
  db: typeof prisma | Parameters<Parameters<typeof prisma.$transaction>[0]>[0] = prisma
): Promise<{ active: number; archived: number }> {
  const [active, archived] = await Promise.all([
    db.gstinProfile.count({ where: { userId, status: GstinStatus.ACTIVE } }),
    db.gstinProfile.count({ where: { userId, status: GstinStatus.ARCHIVED } }),
  ]);
  return { active, archived };
}

/**
 * Real-time GSTIN capacity for a workspace. The single source every gate and
 * dashboard number derives from — never a raw client count.
 */
export async function getGstinCapacity(
  userId: string,
  now: Date = new Date()
): Promise<GSTINCapacityStatus> {
  const sub = await getOrCreateSubscription(userId, now);
  const { active, archived } = await countProfiles(userId);

  let cap = await prisma.gSTINCapacity.findUnique({ where: { userId } });
  const additional = cap?.additionalGSTINs ?? 0;

  // Materialise the plan base and used count so other reads stay consistent.
  if (!cap) {
    cap = await prisma.gSTINCapacity.create({
      data: {
        userId,
        includedGSTINs: sub.includedGSTINs,
        additionalGSTINs: 0,
        usedGSTINs: active,
        effectiveCapacity: sub.includedGSTINs,
      },
    });
  } else if (cap.usedGSTINs !== active || cap.includedGSTINs !== sub.includedGSTINs) {
    cap = await prisma.gSTINCapacity.update({
      where: { userId },
      data: {
        includedGSTINs: sub.includedGSTINs,
        usedGSTINs: active,
        effectiveCapacity: sub.includedGSTINs + additional,
      },
    });
  }

  const snapshot = computeCapacity({
    base: sub.includedGSTINs,
    additional,
    activeCount: active,
    archivedCount: archived,
  });

  const periodNewActivations = await countPeriodNewActivations(userId, sub.startDate);
  const ceiling = computeActivationCeiling(
    snapshot.total,
    GSTIN_ANTI_ABUSE.replacementAllowancePerCycle
  );

  return {
    userId,
    included: snapshot.base,
    additional: snapshot.additional,
    totalCapacity: snapshot.total,
    used: snapshot.active,
    available: snapshot.available,
    usagePercent: snapshot.usagePercent,
    status: snapshot.level,
    canAddMore: sub.isActive && snapshot.hasFreeSlot,
    planName: sub.planName,
    planSlug: sub.planSlug,
    activeProfiles: snapshot.active,
    archivedProfiles: snapshot.archived,
    periodStart: sub.startDate,
    periodEnd: sub.endDate,
    periodNewActivations,
    activationCeiling: ceiling,
  };
}

export type ActivationGate =
  { allowed: true } | { allowed: false; reason: string; capacity: GSTINCapacityStatus };

/**
 * Authoritative server-side gate before bringing a GSTIN into ACTIVE status —
 * whether by creating a new profile or restoring an archived one.
 *
 * Passing the GSTIN lets a restore of a number already activated this period
 * skip the new-activation ceiling: undoing an accidental archive is always free.
 */
export async function canActivateGstin(
  userId: string,
  gstinNumber?: string,
  now: Date = new Date()
): Promise<ActivationGate> {
  const capacity = await getGstinCapacity(userId, now);
  const sub = await getOrCreateSubscription(userId, now);

  if (sub.isExpired) {
    return {
      allowed: false,
      reason:
        "Your subscription / free trial has expired. Renew or upgrade your plan to activate GSTIN profiles.",
      capacity,
    };
  }

  // Churn rate-limit. Raises an admin-review event rather than banning.
  const opsInWindow = await countRecentCapacityOps(userId, now);
  if (isAbnormalChurn({ opsInWindow, maxOpsInWindow: GSTIN_ANTI_ABUSE.maxCapacityOpsPerHour })) {
    await recordCapacityAudit(prisma, {
      userId,
      action: CAPACITY_AUDIT_ACTIONS.ABUSE_REVIEW_TRIGGERED,
      metadata: { opsInWindow, windowMs: GSTIN_ANTI_ABUSE.churnWindowMs, trigger: "ACTIVATION" },
    });
    return {
      allowed: false,
      reason:
        "Too many GSTIN capacity changes in a short time. This has been flagged for review — please wait a while and try again, or contact support.",
      capacity,
    };
  }

  const isReactivation =
    gstinNumber !== undefined && (await wasActivatedThisPeriod(userId, gstinNumber, sub.startDate));

  const decision = evaluateActivation({
    available: capacity.available,
    periodNewActivations: capacity.periodNewActivations,
    activationCeiling: capacity.activationCeiling,
    isReactivationOfKnownGstin: isReactivation,
  });

  if (decision.allowed) return { allowed: true };

  if (decision.code === "NO_CAPACITY") {
    const archivedNote =
      capacity.archivedProfiles > 0
        ? ` You have ${capacity.archivedProfiles} archived GSTIN${capacity.archivedProfiles === 1 ? "" : "s"} — archive an active one to free a slot, or add capacity.`
        : "";
    return {
      allowed: false,
      reason: `GSTIN capacity reached (${capacity.used} of ${capacity.totalCapacity} active).${archivedNote} Add additional GSTIN capacity or upgrade your plan.`,
      capacity,
    };
  }

  // CYCLE_ACTIVATION_LIMIT
  return {
    allowed: false,
    reason: `You have activated ${capacity.periodNewActivations} new GSTINs this billing period, the maximum for your plan. This limit resets on ${capacity.periodEnd.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}. Restoring GSTINs you already used this period is still free.`,
    capacity,
  };
}

/**
 * Backwards-compatible alias. New code should call {@link canActivateGstin}.
 */
export async function canCreateGstin(
  userId: string,
  gstinNumber?: string
): Promise<ActivationGate> {
  return canActivateGstin(userId, gstinNumber);
}

/** Raised when a capacity-changing write cannot proceed. */
export class CapacityError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
    this.name = "CapacityError";
  }
}

/**
 * Archives an ACTIVE profile. Frees its capacity slot immediately; all data is
 * preserved and the profile can be restored later. Never deletes anything.
 */
export async function archiveGstinProfile(
  userId: string,
  profileId: string,
  now: Date = new Date()
): Promise<GSTINCapacityStatus> {
  const opsInWindow = await countRecentCapacityOps(userId, now);
  if (isAbnormalChurn({ opsInWindow, maxOpsInWindow: GSTIN_ANTI_ABUSE.maxCapacityOpsPerHour })) {
    await recordCapacityAudit(prisma, {
      userId,
      action: CAPACITY_AUDIT_ACTIONS.ABUSE_REVIEW_TRIGGERED,
      metadata: { opsInWindow, trigger: "ARCHIVE" },
    });
    throw new CapacityError(
      "Too many GSTIN capacity changes in a short time. Please wait a while and try again.",
      "CHURN_RATE_LIMIT"
    );
  }

  await prisma.$transaction(async (tx) => {
    const profile = await tx.gstinProfile.findFirst({
      where: { id: profileId, userId },
      select: { id: true, status: true, gstinNumber: true, isDefault: true },
    });
    if (!profile) throw new CapacityError("Profile not found.", "NOT_FOUND");
    if (profile.status !== GstinStatus.ACTIVE) {
      throw new CapacityError("Only active profiles can be archived.", "NOT_ACTIVE");
    }

    await tx.gstinProfile.update({
      where: { id: profile.id },
      data: {
        status: GstinStatus.ARCHIVED,
        archivedAt: now,
        statusChangedAt: now,
        // An archived profile must not stay the default filing target.
        isDefault: false,
      },
    });

    await recordCapacityAudit(tx, {
      userId,
      action: CAPACITY_AUDIT_ACTIONS.ARCHIVED,
      metadata: { profileId: profile.id, gstinNumber: profile.gstinNumber },
    });
  });

  billingLogger.info({ userId, profileId }, "GSTIN profile archived");
  return getGstinCapacity(userId, now);
}

/**
 * Restores an ARCHIVED profile back to ACTIVE. Requires a free capacity slot,
 * re-checked inside the transaction so two tabs cannot both take the last slot.
 * A restore of a GSTIN already activated this period does not consume the
 * new-activation ceiling.
 */
export async function restoreGstinProfile(
  userId: string,
  profileId: string,
  now: Date = new Date()
): Promise<GSTINCapacityStatus> {
  const sub = await getOrCreateSubscription(userId, now);

  if (sub.isExpired) {
    throw new CapacityError(
      "Your subscription has expired. Renew before restoring GSTIN profiles.",
      "EXPIRED"
    );
  }

  const opsInWindow = await countRecentCapacityOps(userId, now);
  if (isAbnormalChurn({ opsInWindow, maxOpsInWindow: GSTIN_ANTI_ABUSE.maxCapacityOpsPerHour })) {
    await recordCapacityAudit(prisma, {
      userId,
      action: CAPACITY_AUDIT_ACTIONS.ABUSE_REVIEW_TRIGGERED,
      metadata: { opsInWindow, trigger: "RESTORE" },
    });
    throw new CapacityError(
      "Too many GSTIN capacity changes in a short time. Please wait a while and try again.",
      "CHURN_RATE_LIMIT"
    );
  }

  await prisma.$transaction(async (tx) => {
    const profile = await tx.gstinProfile.findFirst({
      where: { id: profileId, userId },
      select: { id: true, status: true, gstinNumber: true },
    });
    if (!profile) throw new CapacityError("Profile not found.", "NOT_FOUND");
    if (consumesCapacity(profile.status)) {
      throw new CapacityError("This profile is already active.", "ALREADY_ACTIVE");
    }

    // Recompute capacity inside the transaction against the live count.
    const { active, archived } = await countProfiles(userId, tx);
    const capRow = await tx.gSTINCapacity.findUnique({ where: { userId } });
    const snapshot = computeCapacity({
      base: sub.includedGSTINs,
      additional: capRow?.additionalGSTINs ?? 0,
      activeCount: active,
      archivedCount: archived,
    });

    const isReactivation = await wasActivatedThisPeriod(
      userId,
      profile.gstinNumber,
      sub.startDate,
      tx
    );
    const ceiling = computeActivationCeiling(
      snapshot.total,
      GSTIN_ANTI_ABUSE.replacementAllowancePerCycle
    );
    const periodNewActivations = await countPeriodNewActivations(userId, sub.startDate, tx);

    const decision = evaluateActivation({
      available: snapshot.available,
      periodNewActivations,
      activationCeiling: ceiling,
      isReactivationOfKnownGstin: isReactivation,
    });
    if (!decision.allowed) {
      throw new CapacityError(
        decision.code === "NO_CAPACITY"
          ? "No free GSTIN capacity. Archive an active profile or add capacity first."
          : "New-activation limit reached for this billing period.",
        decision.code
      );
    }

    await tx.gstinProfile.update({
      where: { id: profile.id },
      data: { status: GstinStatus.ACTIVE, archivedAt: null, statusChangedAt: now },
    });

    // Idempotent: only counts if this GSTIN is new to the period.
    await recordNewActivation(tx, {
      userId,
      profileId: profile.id,
      gstinNumber: profile.gstinNumber,
      periodStart: sub.startDate,
    });

    await recordCapacityAudit(tx, {
      userId,
      action: CAPACITY_AUDIT_ACTIONS.RESTORED,
      metadata: { profileId: profile.id, gstinNumber: profile.gstinNumber, isReactivation },
    });
  });

  billingLogger.info({ userId, profileId }, "GSTIN profile restored to active");
  return getGstinCapacity(userId, now);
}

export interface PermanentDeleteImpact {
  profileId: string;
  gstinNumber: string;
  legalName: string;
  status: string;
  reportCount: number;
}

/**
 * Counts the historical records tied to a profile's GSTIN, so the confirmation
 * screen can state exactly what the deletion affects before the user commits.
 */
export async function getPermanentDeleteImpact(
  userId: string,
  profileId: string
): Promise<PermanentDeleteImpact | null> {
  const profile = await prisma.gstinProfile.findFirst({
    where: { id: profileId, userId },
    select: { id: true, gstinNumber: true, legalName: true, status: true },
  });
  if (!profile) return null;

  const reportCount = await prisma.conversionHistory.count({
    where: { userId, gstinNumber: profile.gstinNumber },
  });

  return {
    profileId: profile.id,
    gstinNumber: profile.gstinNumber,
    legalName: profile.legalName,
    status: profile.status,
    reportCount,
  };
}

/**
 * Permanently deletes a profile row. Only permitted on a profile that is already
 * archived — permanent deletion must never be the way a live slot is freed
 * (Section 34). Filing history (conversion history, reports, audit) keys off the
 * GSTIN number, not the profile id, so it is preserved.
 */
export async function permanentlyDeleteGstinProfile(
  userId: string,
  profileId: string,
  now: Date = new Date()
): Promise<GSTINCapacityStatus> {
  await prisma.$transaction(async (tx) => {
    const profile = await tx.gstinProfile.findFirst({
      where: { id: profileId, userId },
      select: { id: true, status: true, gstinNumber: true },
    });
    if (!profile) throw new CapacityError("Profile not found.", "NOT_FOUND");
    if (consumesCapacity(profile.status)) {
      throw new CapacityError(
        "Archive this GSTIN before deleting it permanently. Permanent deletion cannot be used to free an active slot.",
        "ACTIVE_CANNOT_DELETE"
      );
    }

    const reportCount = await tx.conversionHistory.count({
      where: { userId, gstinNumber: profile.gstinNumber },
    });

    await tx.gstinProfile.delete({ where: { id: profile.id } });

    await recordCapacityAudit(tx, {
      userId,
      action: CAPACITY_AUDIT_ACTIONS.PERMANENTLY_DELETED,
      metadata: {
        profileId: profile.id,
        gstinNumber: profile.gstinNumber,
        preservedReports: reportCount,
      },
    });
  });

  billingLogger.info({ userId, profileId }, "GSTIN profile permanently deleted");
  return getGstinCapacity(userId, now);
}

/**
 * Calculates server-side prorated charges for additional GSTIN capacity.
 * Prorates based on the exact remaining days in the user's active billing cycle.
 */
export async function calculateGstinAddonProration(
  userId: string,
  quantity: number,
  now: Date = new Date()
): Promise<ProrationCalculation> {
  const qty = Math.max(MIN_GSTIN_ADDON_PACK, Math.floor(quantity));
  const sub = await getOrCreateSubscription(userId, now);

  const totalCycleDays = Math.max(
    1,
    Math.round((sub.endDate.getTime() - sub.startDate.getTime()) / (1000 * 60 * 60 * 24))
  );

  const msRemaining = Math.max(0, sub.endDate.getTime() - now.getTime());
  const remainingDays = Math.max(1, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));

  const fullMonthlyAmount = qty * ADDITIONAL_GSTIN_PRICE_MONTHLY;
  const fractionRemaining = Math.min(1, Math.max(0, remainingDays / totalCycleDays));

  // Prorated amount in whole rupees (ceil ensures at least ₹1)
  const proratedAmount = Math.max(1, Math.ceil(fullMonthlyAmount * fractionRemaining));

  return {
    quantity: qty,
    pricePerGSTIN: ADDITIONAL_GSTIN_PRICE_MONTHLY,
    fullMonthlyAmount,
    proratedAmount,
    remainingDays,
    totalCycleDays,
    cycleEndDate: sub.endDate,
  };
}

/**
 * Purchases additional GSTIN capacity and activates it immediately.
 */
export async function addGstinCapacity(input: {
  userId: string;
  quantity: number;
  amountRupees: number;
  paymentId: string;
  providerOrderId?: string;
}): Promise<GSTINCapacityStatus> {
  const { userId, quantity, amountRupees, paymentId, providerOrderId } = input;
  const now = new Date();
  const sub = await getOrCreateSubscription(userId, now);

  await prisma.$transaction(async (tx) => {
    // 1. Settle the payment. The checkout flow already wrote a CREATED row for
    //    this order — that row is the authoritative record of what was paid for,
    //    so it is updated rather than duplicated. The webhook path has no
    //    pre-existing row, hence the upsert.
    const paymentData = {
      userId,
      provider: "RAZORPAY",
      providerPaymentId: paymentId,
      amount: amountRupees,
      currency: "INR",
      status: "SUCCESS",
      paymentType: "ADDITIONAL_GSTIN",
      planSlug: sub.planSlug,
      metadata: {
        quantity,
        pricePerGSTIN: ADDITIONAL_GSTIN_PRICE_MONTHLY,
        cycleEndDate: sub.endDate.toISOString(),
      },
    };

    if (providerOrderId) {
      await tx.payment.upsert({
        where: { providerOrderId },
        create: { ...paymentData, providerOrderId },
        update: {
          providerPaymentId: paymentId,
          status: "SUCCESS",
          metadata: paymentData.metadata,
        },
      });
    } else {
      await tx.payment.create({ data: paymentData });
    }

    // 2. Record purchase ledger
    await tx.additionalGSTINPurchase.create({
      data: {
        userId,
        quantity,
        pricePerGSTIN: ADDITIONAL_GSTIN_PRICE_MONTHLY,
        amount: amountRupees,
        startDate: now,
        endDate: sub.endDate,
        providerPaymentId: paymentId,
      },
    });

    // 3. Update materialised capacity
    const cap = await tx.gSTINCapacity.findUnique({ where: { userId } });
    const currentAddon = cap?.additionalGSTINs ?? 0;
    const newAddon = currentAddon + quantity;
    const included = cap?.includedGSTINs ?? sub.includedGSTINs;

    await tx.gSTINCapacity.upsert({
      where: { userId },
      create: {
        userId,
        includedGSTINs: included,
        additionalGSTINs: newAddon,
        usedGSTINs: cap?.usedGSTINs ?? 0,
        effectiveCapacity: included + newAddon,
      },
      update: {
        additionalGSTINs: newAddon,
        effectiveCapacity: included + newAddon,
      },
    });

    // 4. Log audit
    await tx.billingAuditLog.create({
      data: {
        userId,
        action: "ADDITIONAL_GSTIN_PURCHASED",
        actorId: userId,
        metadata: {
          quantity,
          amountRupees,
          paymentId,
          newTotalCapacity: included + newAddon,
        },
      },
    });
  });

  billingLogger.info(
    { userId, addedQty: quantity, amountRupees },
    "Additional GSTIN capacity purchased and activated"
  );

  // Send payment receipt email in background
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (user?.email) {
      const { EmailService } = await import("@/features/email/services/email.service");
      void EmailService.sendPaymentReceiptEmail({
        to: user.email,
        name: user.name,
        orderId: providerOrderId || `addon_${Date.now().toString(36)}`,
        paymentId,
        amountRupees,
        planName: `Extra GSTIN Capacity (+${quantity} slots)`,
        gstinSlots: quantity,
      });
    }
  } catch (err) {
    billingLogger.error({ error: err }, "Failed to send additional GSTIN receipt email");
  }

  return getGstinCapacity(userId, now);
}
