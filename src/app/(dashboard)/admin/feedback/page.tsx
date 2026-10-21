import type { Metadata } from "next";
import { requireAdmin } from "@/features/auth";
import {
  getFeedbackCounts,
  listTicketsForAdmin,
} from "@/features/support/services/support.service";
import { AdminFeedbackManager } from "@/features/support/presentation/admin-feedback-manager";
import { Badge, PageHeader } from "@/components/ui";
import { ShieldAlert } from "lucide-react";

export const metadata: Metadata = { title: "Client Feedback & Bug Reports · Admin" };

export default async function AdminFeedbackPage() {
  await requireAdmin();

  const [feedback, counts] = await Promise.all([
    listTicketsForAdmin({ source: "FEEDBACK" }),
    getFeedbackCounts(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration & Voice of Customer"
        title="Client Feedback & Bug Reports"
        description="Real-time issue reports, broken feature alerts, marketplace file anomalies, and feature requests submitted by customers through the floating feedback button."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={counts.open > 0 ? "warning" : "success"}
              size="md"
              dot
              className={
                counts.open > 0
                  ? "bg-amber-500/15 text-amber-700 ring-1 ring-amber-500/30 dark:text-amber-300"
                  : ""
              }
            >
              {counts.open} Needing Action
            </Badge>
            {counts.bugs > 0 && (
              <Badge variant="destructive" size="md">
                <ShieldAlert className="size-3.5" aria-hidden />
                {counts.bugs} Critical / Bugs
              </Badge>
            )}
          </div>
        }
      />

      <AdminFeedbackManager feedback={feedback} counts={counts} />
    </div>
  );
}
