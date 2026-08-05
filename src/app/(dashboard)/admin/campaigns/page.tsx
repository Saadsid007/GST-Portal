import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/features/auth";
import { getAdminBillingConfigAction } from "@/features/billing/actions/admin.actions";
import { PageHeader } from "@/components/ui";
import { AdminBillingSections } from "@/features/billing/presentation/admin-billing-panel";

export const metadata: Metadata = { title: "Campaigns · Admin" };

export default async function AdminPage() {
  // Re-checked here as well as in the layout: a route segment must never rely
  // on an ancestor alone for authorisation.
  await requireAdmin();

  // Fetched here so the module paints with real values on first render rather
  // than flashing a skeleton while a client effect fetches.
  const result = await getAdminBillingConfigAction();
  if (!result.success) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Campaigns"
        description="Seasonal bonus campaigns, referral rewards and the free-trial allowance new accounts receive."
      />
      <AdminBillingSections
        sections={["campaign", "rewards", "trial"]}
        initialConfig={result.data}
      />
    </div>
  );
}
