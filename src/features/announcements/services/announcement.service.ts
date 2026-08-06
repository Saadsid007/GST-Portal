import { unstable_cache } from "next/cache";
import prisma from "@/lib/prisma";

export const ANNOUNCEMENTS_TAG = "announcements";

export interface PublicAnnouncement {
  id: string;
  message: string;
  linkLabel: string | null;
  linkHref: string | null;
}

/**
 * Active announcements for the public strip.
 *
 * Cached and tagged rather than read per request: this runs in the marketing
 * layout, which every public page renders, and those pages are statically
 * generated. Admin writes call `revalidateTag(ANNOUNCEMENTS_TAG)` so a campaign
 * goes live without a deploy, while an unchanged strip costs no query.
 *
 * The schedule window is evaluated in SQL so an expired offer disappears on its
 * own rather than waiting for someone to deactivate it.
 */
export const getActiveAnnouncements = unstable_cache(
  async (): Promise<PublicAnnouncement[]> => {
    const now = new Date();
    const rows = await prisma.announcement.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: { id: true, message: true, linkLabel: true, linkHref: true },
    });
    return rows;
  },
  ["active-announcements"],
  { tags: [ANNOUNCEMENTS_TAG], revalidate: 300 }
);

/** Admin view: everything, including scheduled and disabled rows. */
export async function listAllAnnouncements() {
  return prisma.announcement.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
}
