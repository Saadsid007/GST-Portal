import type { Metadata } from "next";
import { requireAdmin } from "@/features/auth";
import { PageHeader } from "@/components/ui";
import { AdminSubscriptionsPanel } from "@/features/billing/presentation/admin-subscriptions-panel";

export const metadata: Metadata = {
  title: "Subscriptions & Capacity · Admin",
  description: "Manage platform subscriptions, user plans, and GSTIN capacity allocations.",
};

export default async function AdminSubscriptionsPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Subscriptions & Capacity"
        description="Monitor active plans, GSTIN quotas, and platform revenue. Override user tiers, grant extra capacity, or extend durations with immediate effect."
      />
      <AdminSubscriptionsPanel />
    </div>
  );
}
