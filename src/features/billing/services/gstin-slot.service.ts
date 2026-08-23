/**
 * GSTIN slot ledger access.
 *
 * Sits below both the capacity and subscription services — both need to read
 * the same consumed-slot number, and neither may import the other.
 */

import prisma from "@/lib/prisma";
import {
  computeGstinSlotUsage,
  normalizeGstin,
  type GstinSlotUsage,
} from "@/features/billing/domain/gstin-slot-usage";
import type { Prisma } from "@/generated/prisma/client";

/** Prisma client or an interactive transaction client. */
export type SlotDb = Prisma.TransactionClient | typeof prisma;

/**
 * Reads the workspace's slot usage from the creation ledger and live profiles.
 *
 * `periodStart` is the subscription's start date: counting from it is what makes
 * retained slots expire at renewal with no cleanup job.
 */
export async function readGstinSlotUsage(
  userId: string,
  periodStart: Date,
  db: SlotDb = prisma
): Promise<GstinSlotUsage> {
  const [profiles, logs] = await Promise.all([
    db.gstinProfile.findMany({ where: { userId }, select: { gstinNumber: true } }),
    db.gstinCreationLog.findMany({
      where: { userId, createdAt: { gte: periodStart } },
      select: { gstinNumber: true },
    }),
  ]);

  return computeGstinSlotUsage({
    activeGstins: profiles.map((p) => p.gstinNumber),
    periodGstins: logs.map((l) => l.gstinNumber),
  });
}

/** GSTINs recorded against the current period, deleted profiles included. */
export async function readPeriodGstins(
  userId: string,
  periodStart: Date,
  db: SlotDb = prisma
): Promise<string[]> {
  const logs = await db.gstinCreationLog.findMany({
    where: { userId, createdAt: { gte: periodStart } },
    select: { gstinNumber: true },
  });
  return logs.map((l) => l.gstinNumber);
}

/**
 * Appends a creation to the quota ledger. Call inside the same transaction that
 * creates the profile — a profile without a ledger row is a free slot.
 */
export async function recordGstinCreation(
  db: SlotDb,
  input: { userId: string; profileId: string; gstinNumber: string }
): Promise<void> {
  await db.gstinCreationLog.create({
    data: {
      userId: input.userId,
      profileId: input.profileId,
      gstinNumber: normalizeGstin(input.gstinNumber),
    },
  });
}
