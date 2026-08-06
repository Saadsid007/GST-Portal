"use server";

// updateTag rather than revalidateTag: called from a Server Action, it gives
// read-your-own-writes, so the admin sees the strip change immediately.
import { updateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/features/auth";
import prisma from "@/lib/prisma";
import { ANNOUNCEMENTS_TAG } from "@/features/announcements/services/announcement.service";

export interface ActionResult<T = null> {
  success: boolean;
  error?: string;
  data?: T;
}

/**
 * `linkHref` is deliberately restricted. The strip renders on every public page,
 * so an unchecked value here would be a stored-XSS vector via `javascript:` and
 * an open-redirect via arbitrary externals. Internal paths and https only.
 */
const hrefSchema = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v.startsWith("/") || v.startsWith("https://"), {
    message: "Link must be an internal path (/pricing) or an https:// URL",
  });

const announcementSchema = z
  .object({
    message: z.string().trim().min(3, "Message is required").max(200),
    linkLabel: z.string().trim().max(40).optional().or(z.literal("")),
    linkHref: hrefSchema.optional().or(z.literal("")),
    isActive: z.boolean().default(true),
    sortOrder: z.number().int().min(0).max(999).default(0),
    startsAt: z.string().optional().or(z.literal("")),
    endsAt: z.string().optional().or(z.literal("")),
  })
  .refine((v) => !v.linkHref || !!v.linkLabel, {
    message: "A link needs a label",
    path: ["linkLabel"],
  })
  .refine((v) => !v.startsAt || !v.endsAt || new Date(v.startsAt) <= new Date(v.endsAt), {
    message: "The end date must be after the start date",
    path: ["endsAt"],
  });

export type AnnouncementInput = z.input<typeof announcementSchema>;

function toDate(value?: string): Date | null {
  return value ? new Date(value) : null;
}

export async function saveAnnouncementAction(
  input: AnnouncementInput,
  id?: string
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = announcementSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid announcement" };
  }
  const v = parsed.data;

  const data = {
    message: v.message,
    linkLabel: v.linkLabel || null,
    linkHref: v.linkHref || null,
    isActive: v.isActive,
    sortOrder: v.sortOrder,
    startsAt: toDate(v.startsAt),
    endsAt: toDate(v.endsAt),
  };

  try {
    if (id) await prisma.announcement.update({ where: { id }, data });
    else await prisma.announcement.create({ data });
  } catch {
    return { success: false, error: "Could not save the announcement" };
  }

  updateTag(ANNOUNCEMENTS_TAG);
  return { success: true };
}

export async function setAnnouncementActiveAction(
  id: string,
  isActive: boolean
): Promise<ActionResult> {
  await requireAdmin();
  try {
    await prisma.announcement.update({ where: { id }, data: { isActive } });
  } catch {
    return { success: false, error: "Could not update the announcement" };
  }
  updateTag(ANNOUNCEMENTS_TAG);
  return { success: true };
}

export async function deleteAnnouncementAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    await prisma.announcement.delete({ where: { id } });
  } catch {
    return { success: false, error: "Could not delete the announcement" };
  }
  updateTag(ANNOUNCEMENTS_TAG);
  return { success: true };
}
