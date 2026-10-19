import type { Metadata } from "next";
import { requireAdmin } from "@/features/auth";
import { PageHeader } from "@/components/ui";
import { AdminSubscriptionsPanel } from "@/features/billing/presentation/admin-subscriptions-panel";

export const metadata: Metadata = {
  title: "Users & plans · Admin",
  description: "Every account with its contact details, plan, validity and last activity.",
};

export default async function AdminSubscriptionsPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Users & plans"
        description="Open any account to see its email, mobile, plan and last activity — and to change validity, plan or GSTIN capacity, or delete it."
      />
      <AdminSubscriptionsPanel />
    </div>
  );
}
