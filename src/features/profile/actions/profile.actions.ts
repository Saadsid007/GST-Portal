"use server";

import { requireSession } from "@/features/auth";
import {
  canCreateGstin,
  getGstinDeletionImpact,
  type GstinDeletionImpact,
} from "@/features/billing/services/capacity.service";
import { recordGstinCreation } from "@/features/billing/services/gstin-slot.service";
import { normalizeGstin } from "@/features/billing/domain/gstin-slot-usage";
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

export async function addGstinProfileAction(input: {
  gstinNumber: string;
  legalName: string;
  tradeName?: string;
  businessType?: string;
  isDefault?: boolean;
}) {
  const session = await requireSession();
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const { legalName, tradeName, businessType, isDefault } = parsed.data;
  const gstinNumber = normalizeGstin(parsed.data.gstinNumber);

  const duplicate = await prisma.gstinProfile.findFirst({
    where: { userId: session.user.id, gstinNumber },
    select: { id: true },
  });
  if (duplicate) {
    return { success: false, error: "This GSTIN is already in your profiles." };
  }

  // The GSTIN is passed so a number that already consumed a slot this period —
  // one the user deleted by mistake — can be re-added without paying twice.
  const gate = await canCreateGstin(session.user.id, gstinNumber);
  if (!gate.allowed) return { success: false, error: gate.reason };

  const stateCode = gstinNumber.substring(0, 2);
  const stateName = getStateName(stateCode);

  const profile = await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await tx.gstinProfile.updateMany({
        where: { userId: session.user.id },
        data: { isDefault: false },
      });
    }

    const created = await tx.gstinProfile.create({
      data: {
        userId: session.user.id,
        gstinNumber,
        legalName,
        tradeName: tradeName || null,
        businessType,
        stateCode,
        stateName,
        isDefault: isDefault ?? false,
      },
    });

    // Same transaction as the profile: a profile without a ledger row would be
    // a slot the plan never charged for.
    await recordGstinCreation(tx, {
      userId: session.user.id,
      profileId: created.id,
      gstinNumber,
    });

    return created;
  });

  revalidatePath("/profile");
  revalidatePath("/billing");
  return { success: true, data: profile };
}

/**
 * What the user gives up by deleting a profile, for the confirmation dialog.
 * Returns null when the profile is not theirs or already gone.
 */
export async function getGstinDeletionImpactAction(
  profileId: string
): Promise<{ success: boolean; data?: GstinDeletionImpact; error?: string }> {
  const session = await requireSession();
  const impact = await getGstinDeletionImpact(session.user.id, profileId);
  if (!impact) return { success: false, error: "Profile not found." };
  return { success: true, data: impact };
}

export async function deleteGstinProfileAction(profileId: string) {
  const session = await requireSession();

  // Read the impact before the row disappears, so the response can tell the
  // user exactly what happened to the slot.
  const impact = await getGstinDeletionImpact(session.user.id, profileId);

  const { count } = await prisma.gstinProfile.deleteMany({
    where: { id: profileId, userId: session.user.id },
  });
  if (count === 0) return { success: false, error: "Profile not found." };

  // The creation log is deliberately left intact — it is the record that keeps
  // the slot consumed until renewal and the audit trail for the period.
  revalidatePath("/profile");
  revalidatePath("/billing");
  return {
    success: true,
    slotRetained: impact?.slotRetained ?? false,
    releasesOn: impact?.releasesOn ?? null,
  };
}

export async function setDefaultGstinAction(profileId: string) {
  const session = await requireSession();
  await prisma.gstinProfile.updateMany({
    where: { userId: session.user.id },
    data: { isDefault: false },
  });
  await prisma.gstinProfile.updateMany({
    where: { id: profileId, userId: session.user.id },
    data: { isDefault: true },
  });
  revalidatePath("/profile");
  return { success: true };
}
