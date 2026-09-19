"use server";

import { requireSession } from "@/features/auth";
import prisma from "@/lib/prisma";
import type { ColumnMappingDict } from "@/features/convert/engine/universal/canonical-fields";
import {
  fingerprintHeaders,
  mappingFitsHeaders,
} from "@/features/convert/domain/column-fingerprint";

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

/**
 * Remembers how a file was mapped, so the next upload of the same export does
 * not have to ask again.
 *
 * Called once the user has accepted the mapping — not when the model proposes
 * one. An unreviewed guess stored as memory would repeat itself confidently
 * for every future upload, which is worse than asking.
 */
export async function rememberMappingAction(input: {
  headers: string[];
  mappings: ColumnMappingDict;
  platformId: string;
  fileName: string;
}) {
  const session = await requireSession();

  const fingerprint = fingerprintHeaders(input.headers);
  if (!fingerprint) {
    return { success: false as const, error: "This file has too few columns to remember." };
  }

  const record = await prisma.mappingProfile.upsert({
    where: { userId_fingerprint: { userId: session.user.id, fingerprint } },
    create: {
      userId: session.user.id,
      name: input.fileName,
      platformId: input.platformId,
      mappings: input.mappings as never,
      sourceHeaders: input.headers as never,
      fingerprint,
      isDefault: false,
      useCount: 0,
    },
    update: {
      // A fresh confirmation supersedes what was stored: the user has just
      // looked at this file and said what its columns mean.
      mappings: input.mappings as never,
      sourceHeaders: input.headers as never,
      platformId: input.platformId,
    },
  });

  return { success: true as const, data: { id: record.id, fingerprint } };
}

export interface RecalledMapping {
  mappings: ColumnMappingDict;
  /** How many earlier uploads this mapping has already served. */
  useCount: number;
  lastUsedAt: Date | null;
}

/**
 * Looks up a mapping this user has already confirmed for this exact file shape.
 *
 * Returns null rather than a near-match. Applying a remembered mapping to a
 * file whose columns have shifted would produce a filed return that is quietly
 * wrong, which is a worse outcome than one more question.
 */
export async function recallMappingAction(
  headers: string[]
): Promise<{ success: true; data: RecalledMapping | null }> {
  const session = await requireSession();

  const fingerprint = fingerprintHeaders(headers);
  if (!fingerprint) return { success: true as const, data: null };

  const stored = await prisma.mappingProfile.findUnique({
    where: { userId_fingerprint: { userId: session.user.id, fingerprint } },
  });
  if (!stored) return { success: true as const, data: null };

  const mappings = stored.mappings as ColumnMappingDict;
  if (!mappingFitsHeaders(mappings, headers)) {
    return { success: true as const, data: null };
  }

  await prisma.mappingProfile.update({
    where: { id: stored.id },
    data: { useCount: { increment: 1 }, lastUsedAt: new Date() },
  });

  return {
    success: true as const,
    data: { mappings, useCount: stored.useCount, lastUsedAt: stored.lastUsedAt },
  };
}
