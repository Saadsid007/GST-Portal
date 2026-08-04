import type { Metadata } from "next";
import { AdminUsersPanel } from "@/features/auth/presentation/admin-users-panel";
import { AdminBillingPanel } from "@/features/billing/presentation/admin-billing-panel";

export const metadata: Metadata = { title: "Admin Console · GSTPilot" };

export default function AdminHomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Admin Console</h1>
        <p className="pt-1 text-sm text-muted-foreground">
          Manage administrators, pricing, wallets, credit codes and campaigns. Every change is
          written to the audit log.
        </p>
      </div>

      <AdminUsersPanel />
      <AdminBillingPanel />
    </div>
  );
}
