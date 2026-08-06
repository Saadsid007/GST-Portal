import type { Metadata } from "next";
import { requireAdmin } from "@/features/auth";
import { listAllAnnouncements } from "@/features/announcements/services/announcement.service";
import { AdminAnnouncementsPanel } from "@/features/announcements/presentation/admin-announcements-panel";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Announcements · Admin" };

export default async function AdminAnnouncementsPage() {
  await requireAdmin();
  const announcements = await listAllAnnouncements();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Announcements"
        description="The offer strip above the public header. Several active announcements scroll together, and each one can carry its own link and schedule."
      />
      <AdminAnnouncementsPanel announcements={announcements} />
    </div>
  );
}
