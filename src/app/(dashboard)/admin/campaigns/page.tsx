import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/features/auth";
import { getAdminBillingConfigAction } from "@/features/billing/actions/admin.actions";
import { PageHeader } from "@/components/ui";
import { AdminCampaignsMarketingPanel } from "@/features/campaigns/presentation/admin-campaigns-panel";
import { AdminBillingSections } from "@/features/billing/presentation/admin-billing-panel";
import { BroadcastHistory } from "@/features/campaigns/presentation/broadcast-history";

export const metadata: Metadata = { title: "Campaigns & Marketing · Admin" };

export default async function AdminCampaignsPage() {
  await requireAdmin();

  const result = await getAdminBillingConfigAction();
  if (!result.success) notFound();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Administration"
        title="Marketing Audience & Campaigns"
        description="View registered user emails, manage lead lists, export CSV for marketing tools, and send broadcast announcements."
      />

      <AdminCampaignsMarketingPanel />

      <BroadcastHistory />

      <div className="border-t border-border pt-6">
        <div className="mb-4">
          <h2 className="text-base font-bold">Referral rewards</h2>
          <p className="text-xs text-muted-foreground">
            Credits each side earns when a referred seller buys their first plan. 1 credit = ₹1 off
            any plan or add-on.
          </p>
        </div>
        <AdminBillingSections sections={["rewards"]} initialConfig={result.data} />
      </div>
    </div>
  );
}
