"use server";

import { requireSession } from "@/features/auth";
import {
  canActivateGstin,
  archiveGstinProfile,
  restoreGstinProfile,
  permanentlyDeleteGstinProfile,
  getPermanentDeleteImpact,
  CapacityError,
  type PermanentDeleteImpact,
} from "@/features/billing/services/capacity.service";
import {
  recordNewActivation,
  recordCapacityAudit,
  CAPACITY_AUDIT_ACTIONS,
} from "@/features/billing/services/gstin-activity.service";
import { getOrCreateSubscription } from "@/features/billing/services/subscription.service";
import { normalizeGstin, GstinStatus } from "@/features/billing/domain/gstin-capacity";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[0-9A-Z]{1}[0-9A-Z]{1}$/;
import { getStateName } from "@/features/convert/domain/state-codes";
import { BUSINESS_TYPES } from "@/features/profile/domain/business-type";

const addSchema = z.object({
  gstinNumber: z.string().regex(GSTIN_REGEX, "Invalid GSTIN format"),
  legalName: z.string().min(2, "Legal name is required"),
  tradeName: z.string().optional(),
  businessType: z.enum(BUSINESS_TYPES).default("OTHER"),
  isDefault: z.boolean().default(false),
});

/**
 * Creates and activates a new GSTIN profile.
 *
 * A GSTIN the workspace already holds — active or archived — is never
 * duplicated: the caller is told to restore the archived one instead. Capacity
 * and the anti-abuse ceiling are enforced server-side, and the create + its
 * activation-ledger row commit in one transaction so a profile can never exist
 * without being counted.
 */
export async function addGstinProfileAction(input: {
  gstinNumber: string;
  legalName: string;
  tradeName?: string;
  businessType?: string;
  isDefault?: boolean;
}) {
  const session = await requireSession();
  const userId = session.user.id;
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const { legalName, tradeName, businessType, isDefault } = parsed.data;
  const gstinNumber = normalizeGstin(parsed.data.gstinNumber);

  const existing = await prisma.gstinProfile.findFirst({
    where: { userId, gstinNumber },
    select: { id: true, status: true },
  });
  if (existing) {
    return {
      success: false,
      error:
        existing.status === GstinStatus.ACTIVE
          ? "This GSTIN is already in your active profiles."
          : "This GSTIN is archived. Restore it instead of adding it again.",
    };
  }

  const gate = await canActivateGstin(userId, gstinNumber);
  if (!gate.allowed) return { success: false, error: gate.reason };

  const stateCode = gstinNumber.substring(0, 2);
  const stateName = getStateName(stateCode);
  const sub = await getOrCreateSubscription(userId);
  const now = new Date();

  try {
    const profile = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.gstinProfile.updateMany({
          where: { userId },
          data: { isDefault: false },
        });
      }

      const created = await tx.gstinProfile.create({
        data: {
          userId,
          gstinNumber,
          legalName,
          tradeName: tradeName || null,
          businessType,
          stateCode,
          stateName,
          isDefault: isDefault ?? false,
          status: GstinStatus.ACTIVE,
          statusChangedAt: now,
        },
      });

      // Same transaction as the profile: an activation the ceiling never saw
      // would let the abuse cap be bypassed.
      await recordNewActivation(tx, {
        userId,
        profileId: created.id,
        gstinNumber,
        periodStart: sub.startDate,
      });

      await recordCapacityAudit(tx, {
        userId,
        action: CAPACITY_AUDIT_ACTIONS.ACTIVATED,
        metadata: { profileId: created.id, gstinNumber },
      });

      return created;
    });

    revalidatePath("/profile");
    revalidatePath("/billing");
    return { success: true, data: profile };
  } catch (err) {
    // Unique (userId, gstinNumber) — a parallel request won the race.
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      return { success: false, error: "This GSTIN is already in your profiles." };
    }
    throw err;
  }
}

/**
 * Archives an active profile. Frees the capacity slot immediately; the profile
 * and all its data are preserved and can be restored.
 */
export async function archiveGstinProfileAction(profileId: string) {
  const session = await requireSession();
  try {
    const capacity = await archiveGstinProfile(session.user.id, profileId);
    revalidatePath("/profile");
    revalidatePath("/billing");
    return { success: true, capacity };
  } catch (err) {
    if (err instanceof CapacityError) return { success: false, error: err.message };
    throw err;
  }
}

/**
 * Restores an archived profile back to active. Requires a free capacity slot.
 */
export async function restoreGstinProfileAction(profileId: string) {
  const session = await requireSession();
  try {
    const capacity = await restoreGstinProfile(session.user.id, profileId);
    revalidatePath("/profile");
    revalidatePath("/billing");
    return { success: true, capacity };
  } catch (err) {
    if (err instanceof CapacityError) return { success: false, error: err.message };
    throw err;
  }
}

/**
 * Historical records tied to a profile, for the permanent-delete confirmation.
 */
export async function getPermanentDeleteImpactAction(
  profileId: string
): Promise<{ success: boolean; data?: PermanentDeleteImpact; error?: string }> {
  const session = await requireSession();
  const impact = await getPermanentDeleteImpact(session.user.id, profileId);
  if (!impact) return { success: false, error: "Profile not found." };
  return { success: true, data: impact };
}

/**
 * Permanently deletes an archived profile. Filing history is preserved.
 */
export async function permanentlyDeleteGstinProfileAction(profileId: string) {
  const session = await requireSession();
  try {
    await permanentlyDeleteGstinProfile(session.user.id, profileId);
    revalidatePath("/profile");
    revalidatePath("/billing");
    return { success: true };
  } catch (err) {
    if (err instanceof CapacityError) return { success: false, error: err.message };
    throw err;
  }
}

export async function setDefaultGstinAction(profileId: string) {
  const session = await requireSession();
  // Only an active profile can be the default filing target.
  const target = await prisma.gstinProfile.findFirst({
    where: { id: profileId, userId: session.user.id, status: GstinStatus.ACTIVE },
    select: { id: true },
  });
  if (!target)
    return { success: false, error: "Only active GSTIN profiles can be set as default." };

  await prisma.$transaction(async (tx) => {
    await tx.gstinProfile.updateMany({
      where: { userId: session.user.id },
      data: { isDefault: false },
    });
    await tx.gstinProfile.update({
      where: { id: profileId },
      data: { isDefault: true },
    });
  });
  revalidatePath("/profile");
  return { success: true };
}
