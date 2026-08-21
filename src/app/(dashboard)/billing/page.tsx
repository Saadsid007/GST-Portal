import type { Metadata } from "next";
import { requireSession } from "@/features/auth";
import { getBillingOverviewAction } from "@/features/billing/actions/billing.actions";
import { BillingDashboard } from "@/features/billing/presentation/billing-dashboard";

export const metadata: Metadata = {
  title: "Subscription & Plans — GSTPilot",
  description: "Manage your GSTPilot subscription, client GSTIN capacity, and invoices.",
};

export default async function BillingPage() {
  await requireSession();
  const res = await getBillingOverviewAction();

  if (!res.success || !res.data) {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-center text-sm font-semibold text-destructive">
        {res.error || "Failed to load billing details. Please refresh the page."}
      </div>
    );
  }

  return <BillingDashboard initialData={res.data} />;
}
