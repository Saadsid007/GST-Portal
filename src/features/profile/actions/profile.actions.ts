"use server";

import { requireSession } from "@/features/auth";
import { canCreateGstin } from "@/features/billing/services/capacity.service";
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

  const gate = await canCreateGstin(session.user.id);
  if (!gate.allowed) return { success: false, error: gate.reason };

  const { gstinNumber, legalName, tradeName, businessType, isDefault } = parsed.data;
  const stateCode = gstinNumber.substring(0, 2);
  const stateName = getStateName(stateCode);

  if (isDefault) {
    await prisma.gstinProfile.updateMany({
      where: { userId: session.user.id },
      data: { isDefault: false },
    });
  }

  const profile = await prisma.gstinProfile.create({
    data: {
      userId: session.user.id,
      gstinNumber: gstinNumber.toUpperCase(),
      legalName,
      tradeName: tradeName || null,
      businessType,
      stateCode,
      stateName,
      isDefault: isDefault ?? false,
    },
  });

  revalidatePath("/profile");
  return { success: true, data: profile };
}

export async function deleteGstinProfileAction(profileId: string) {
  const session = await requireSession();
  await prisma.gstinProfile.deleteMany({
    where: { id: profileId, userId: session.user.id },
  });
  revalidatePath("/profile");
  return { success: true };
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
