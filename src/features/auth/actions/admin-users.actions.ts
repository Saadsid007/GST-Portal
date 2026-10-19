"use server";

import { revalidatePath } from "next/cache";
import { isAdmin, requireAdmin } from "@/features/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import type { ActionResult } from "@/features/billing/types/billing.types";

/**
 * Admin roster management. Kept separate from `billing/actions/admin.actions` because
 * granting access is an identity concern, not a pricing one.
 */

const emailSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
});

export interface AdminRow {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  isSelf: boolean;
}

async function audit(
  actorId: string,
  action: string,
  targetId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  await prisma.auditLog.create({
    data: { actorId, action, targetType: "User", targetId, metadata: metadata as never },
  });
}

/**
 * Lets the admin login screen decide where to send a user *after* their password has
 * already been accepted, without leaking role information to anonymous callers.
 */
export async function isCurrentUserAdminAction(): Promise<boolean> {
  return isAdmin();
}

export async function listAdminsAction(): Promise<ActionResult<AdminRow[]>> {
  const session = await requireAdmin();
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, createdAt: true },
  });

  return {
    success: true,
    data: admins.map((admin) => ({
      id: admin.id,
      name: admin.name,
      email: admin.email,
      createdAt: admin.createdAt.toISOString(),
      isSelf: admin.id === session.user.id,
    })),
  };
}

export async function grantAdminAction(input: unknown): Promise<ActionResult<null>> {
  const session = await requireAdmin();
  const parsed = emailSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid email" };
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) {
    return { success: false, error: "No account with that email. They must register first." };
  }
  if (user.role === "ADMIN") {
    return { success: false, error: "That account is already an admin." };
  }

  await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
  await audit(session.user.id, "ADMIN_GRANTED", user.id, { email: user.email });
  revalidatePath("/admin");
  return { success: true, data: null };
}

/** The address a deleted account is parked on, freeing the real one. */
function parkedEmail(userId: string): string {
  return `deleted.${userId}@deleted.invalid`;
}

const userIdSchema = z.string().min(1).max(64);

/**
 * Deletes an account the way the business needs it deleted: gone for the
 * person, kept for the books.
 *
 * Nothing is erased — payments, GSTINs and returns stay, as the records an
 * accountant and the tax department may ask for. The account is signed out
 * everywhere and its email is parked on an address nobody can own, so:
 *   - signing in with the old email reads as a wrong password, and nothing
 *     tells the person their account was removed;
 *   - signing up again with the same email makes a brand-new account with
 *     none of the old data.
 */
export async function adminDeleteUserAction(userId: string): Promise<ActionResult<null>> {
  const session = await requireAdmin();
  const id = userIdSchema.safeParse(userId);
  if (!id.success) return { success: false, error: "Invalid user." };

  if (id.data === session.user.id) {
    return { success: false, error: "You cannot delete your own account." };
  }
  const user = await prisma.user.findUnique({ where: { id: id.data } });
  if (!user || user.deletedAt) {
    return { success: false, error: "That account does not exist or is already deleted." };
  }
  if (user.role === "ADMIN") {
    return { success: false, error: "Remove admin access first, then delete the account." };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { deletedAt: new Date(), originalEmail: user.email, email: parkedEmail(user.id) },
    }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
    // Stops campaign mail. A new signup on the same address subscribes again.
    prisma.marketingSubscriber.updateMany({
      where: { OR: [{ userId: user.id }, { email: user.email }] },
      data: { status: "UNSUBSCRIBED" },
    }),
  ]);
  await audit(session.user.id, "USER_DELETED", user.id, { email: user.email });

  revalidatePath("/admin");
  revalidatePath("/admin/subscriptions");
  return { success: true, data: null };
}

/**
 * Undoes a deletion, provided the person has not since signed up again on the
 * same email — two live accounts cannot share an address.
 */
export async function adminRestoreUserAction(userId: string): Promise<ActionResult<null>> {
  const session = await requireAdmin();
  const id = userIdSchema.safeParse(userId);
  if (!id.success) return { success: false, error: "Invalid user." };

  const user = await prisma.user.findUnique({ where: { id: id.data } });
  if (!user?.deletedAt || !user.originalEmail) {
    return { success: false, error: "That account is not deleted." };
  }
  const taken = await prisma.user.findUnique({ where: { email: user.originalEmail } });
  if (taken) {
    return {
      success: false,
      error: `${user.originalEmail} already has a new account, so this one cannot be restored.`,
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { deletedAt: null, email: user.originalEmail, originalEmail: null },
  });
  await audit(session.user.id, "USER_RESTORED", user.id, { email: user.originalEmail });

  revalidatePath("/admin");
  revalidatePath("/admin/subscriptions");
  return { success: true, data: null };
}

export async function revokeAdminAction(userId: string): Promise<ActionResult<null>> {
  const session = await requireAdmin();

  // Locking yourself out is unrecoverable from the UI, so it is refused outright.
  if (userId === session.user.id) {
    return { success: false, error: "You cannot remove your own admin access." };
  }

  const remaining = await prisma.user.count({ where: { role: "ADMIN" } });
  if (remaining <= 1) {
    return { success: false, error: "At least one admin must remain." };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== "ADMIN") {
    return { success: false, error: "That account is not an admin." };
  }

  await prisma.user.update({ where: { id: userId }, data: { role: "USER" } });
  await audit(session.user.id, "ADMIN_REVOKED", userId, { email: user.email });
  revalidatePath("/admin");
  return { success: true, data: null };
}
