import type { Metadata } from "next";
import { requireAdmin } from "@/features/auth";
import { PageHeader } from "@/components/ui";
import { AdminWalletTools } from "@/features/billing/presentation/admin-wallet-tools";

export const metadata: Metadata = { title: "Wallets · Admin" };

export default async function AdminPage() {
  // Re-checked here as well as in the layout: a route segment must never rely
  // on an ancestor alone for authorisation.
  await requireAdmin();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Wallets"
        description="Look up any user's credits, add or take back credits, or freeze a wallet. 1 credit = ₹1 off their next plan or add-on, applied automatically at checkout. Every change is in the audit log."
      />
      <AdminWalletTools />
    </div>
  );
}
