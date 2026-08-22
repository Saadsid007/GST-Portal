import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/features/auth";
import { getAdminBillingConfigAction } from "@/features/billing/actions/admin.actions";
import { PageHeader } from "@/components/ui";
import { AdminCampaignsMarketingPanel } from "@/features/campaigns/presentation/admin-campaigns-panel";
import { AdminBillingSections } from "@/features/billing/presentation/admin-billing-panel";

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

      <div className="pt-6 border-t border-border">
        <div className="mb-4">
          <h2 className="text-base font-bold">Promotional Rules & Trial Defaults</h2>
          <p className="text-xs text-muted-foreground">
            Configure seasonal bonus campaign rates, referral reward tiers and fallback trial days.
          </p>
        </div>
        <AdminBillingSections
          sections={["campaign", "rewards", "trial"]}
          initialConfig={result.data}
        />
      </div>
    </div>
  );
}
