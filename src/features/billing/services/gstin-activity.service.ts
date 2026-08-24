/**
 * GSTIN activity + audit ledger.
 *
 * Sits below the capacity and subscription services so both can record and read
 * the same activation history without importing each other. Two jobs:
 *
 *  - the per-period new-activation counter that feeds the anti-abuse ceiling
 *    (GstinCreationLog), and
 *  - the capacity audit trail and churn window (BillingAuditLog).
 */

import prisma from "@/lib/prisma";
import { normalizeGstin } from "@/features/billing/domain/gstin-capacity";
import { GSTIN_ANTI_ABUSE } from "@/features/billing/config/pricing.config";
import type { Prisma } from "@/generated/prisma/client";

export type CapacityDb = Prisma.TransactionClient | typeof prisma;

/** Capacity-affecting audit actions, per Section 23 of the billing spec. */
export const CAPACITY_AUDIT_ACTIONS = {
  ACTIVATED: "GSTIN_ACTIVATED",
  ARCHIVED: "GSTIN_ARCHIVED",
  RESTORED: "GSTIN_RESTORED",
  DEACTIVATED_FOR_BILLING: "GSTIN_DEACTIVATED_FOR_BILLING",
  PERMANENTLY_DELETED: "GSTIN_PERMANENTLY_DELETED",
  CAPACITY_WARNING: "CAPACITY_WARNING",
  ABUSE_REVIEW_TRIGGERED: "ABUSE_REVIEW_TRIGGERED",
} as const;

/** The operations that count as churn for rate-limiting. */
const CHURN_ACTIONS: string[] = [
  CAPACITY_AUDIT_ACTIONS.ACTIVATED,
  CAPACITY_AUDIT_ACTIONS.ARCHIVED,
  CAPACITY_AUDIT_ACTIONS.RESTORED,
];

/**
 * Records that a brand-new GSTIN was activated this period. Call inside the same
 * transaction as the profile activation — a profile with no ledger row would be
 * an activation the ceiling never saw. Idempotent per (user, GSTIN, period):
 * a restore of a GSTIN already logged this period must not inflate the count.
 */
export async function recordNewActivation(
  db: CapacityDb,
  input: { userId: string; profileId: string; gstinNumber: string; periodStart: Date }
): Promise<void> {
  const gstinNumber = normalizeGstin(input.gstinNumber);
  const alreadyLogged = await db.gstinCreationLog.findFirst({
    where: { userId: input.userId, gstinNumber, createdAt: { gte: input.periodStart } },
    select: { id: true },
  });
  if (alreadyLogged) return;

  await db.gstinCreationLog.create({
    data: { userId: input.userId, profileId: input.profileId, gstinNumber },
  });
}

/** Distinct brand-new GSTINs activated in the current period. */
export async function countPeriodNewActivations(
  userId: string,
  periodStart: Date,
  db: CapacityDb = prisma
): Promise<number> {
  const rows = await db.gstinCreationLog.findMany({
    where: { userId, createdAt: { gte: periodStart } },
    select: { gstinNumber: true },
  });
  return new Set(rows.map((r) => r.gstinNumber)).size;
}

/** Whether a GSTIN was already activated in the current period (restore is free). */
export async function wasActivatedThisPeriod(
  userId: string,
  gstinNumber: string,
  periodStart: Date,
  db: CapacityDb = prisma
): Promise<boolean> {
  const row = await db.gstinCreationLog.findFirst({
    where: { userId, gstinNumber: normalizeGstin(gstinNumber), createdAt: { gte: periodStart } },
    select: { id: true },
  });
  return row !== null;
}

/** Capacity-changing operations in the trailing churn window. */
export async function countRecentCapacityOps(
  userId: string,
  now: Date = new Date(),
  db: CapacityDb = prisma
): Promise<number> {
  const since = new Date(now.getTime() - GSTIN_ANTI_ABUSE.churnWindowMs);
  return db.billingAuditLog.count({
    where: { userId, action: { in: CHURN_ACTIONS }, createdAt: { gte: since } },
  });
}

/** Writes a capacity audit event. Best kept in the same tx as the change. */
export async function recordCapacityAudit(
  db: CapacityDb,
  input: {
    userId: string;
    action: string;
    metadata?: Prisma.InputJsonValue;
  }
): Promise<void> {
  await db.billingAuditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      actorId: input.userId,
      metadata: input.metadata,
    },
  });
}
