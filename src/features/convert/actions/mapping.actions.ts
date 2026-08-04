"use server";

import { requireSession } from "@/features/auth";
import prisma from "@/lib/prisma";
import type { ColumnMappingDict } from "@/features/convert/engine/mapping/mapping.templates";

// Save or update custom mapping profile in DB
export async function saveMappingProfileAction(input: {
  name: string;
  platformId: string;
  mappings: ColumnMappingDict;
  isDefault?: boolean;
}) {
  const session = await requireSession();

  if (input.isDefault) {
    await prisma.mappingProfile.updateMany({
      where: { userId: session.user.id, platformId: input.platformId },
      data: { isDefault: false },
    });
  }

  const record = await prisma.mappingProfile.create({
    data: {
      userId: session.user.id,
      name: input.name,
      platformId: input.platformId,
      mappings: input.mappings as never,
      isDefault: input.isDefault ?? true,
    },
  });

  return { success: true as const, data: { id: record.id } };
}

// Get saved mapping profiles for a user
export async function getUserMappingProfilesAction(platformId?: string) {
  const session = await requireSession();

  const profiles = await prisma.mappingProfile.findMany({
    where: {
      userId: session.user.id,
      ...(platformId ? { platformId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  return { success: true as const, data: profiles };
}

// Delete a saved mapping profile
export async function deleteMappingProfileAction(id: string) {
  const session = await requireSession();

  await prisma.mappingProfile.deleteMany({
    where: { id, userId: session.user.id },
  });

  return { success: true as const };
}
