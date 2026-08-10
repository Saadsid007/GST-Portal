"use server";

import { z } from "zod";

import { requireSession } from "@/features/auth";
import { getPlatformConfig } from "@/features/convert/config/platform.config";
import prisma from "@/lib/prisma";

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[0-9A-Z]{1}[0-9A-Z]{1}$/;

const saveSchema = z.object({
  gstinNumber: z.string().min(1),
  platformId: z.string().min(1),
  /** Blank clears the mapping, so the user can undo a wrong entry without a delete button. */
  ecoGstin: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || GSTIN_REGEX.test(v), {
      message: "Enter a valid 15-character GSTIN",
    }),
});

/** The operator GSTINs this user has recorded for one of their own GSTINs, keyed by platform. */
export async function loadEcoOperatorsAction(gstinNumber: string) {
  const session = await requireSession();

  const rows = await prisma.ecoOperatorGstin.findMany({
    where: { userId: session.user.id, gstinNumber },
    select: { platformId: true, ecoGstin: true },
  });

  return {
    success: true as const,
    data: Object.fromEntries(rows.map((r) => [r.platformId, r.ecoGstin])),
  };
}

export async function saveEcoOperatorAction(input: z.input<typeof saveSchema>) {
  const session = await requireSession();

  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { gstinNumber, platformId, ecoGstin } = parsed.data;

  if (ecoGstin === "") {
    await prisma.ecoOperatorGstin.deleteMany({
      where: { userId: session.user.id, gstinNumber, platformId },
    });
    return { success: true as const, data: { ecoGstin: "" } };
  }

  // Table 14 reports supplies on which *someone else* collected TCS. Accepting the seller's own
  // GSTIN here would report them as their own operator, which the portal rejects.
  if (ecoGstin === gstinNumber.toUpperCase()) {
    return {
      success: false as const,
      error: "This is your own GSTIN — enter the marketplace operator's GSTIN instead",
    };
  }

  await prisma.ecoOperatorGstin.upsert({
    where: { userId_gstinNumber_platformId: { userId: session.user.id, gstinNumber, platformId } },
    create: {
      userId: session.user.id,
      gstinNumber,
      platformId,
      ecoGstin,
      ecoName: getPlatformConfig(platformId).name,
    },
    update: { ecoGstin },
  });

  return { success: true as const, data: { ecoGstin } };
}
