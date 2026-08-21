import type { Metadata } from "next";
import { requireAdmin } from "@/features/auth";
import { PageHeader } from "@/components/ui";
import { AdminUsersPanel } from "@/features/auth/presentation/admin-users-panel";

export const metadata: Metadata = { title: "Users · Admin" };

export default async function AdminPage() {
  // Re-checked here as well as in the layout: a route segment must never rely
  // on an ancestor alone for authorisation.
  await requireAdmin();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Users"
        description="Accounts, roles and administrator access. Promoting a user takes effect immediately — the role is read from the database on every request, not from their session."
      />
      <div className="flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs">
        <div>
          <p className="font-bold text-foreground">Need to manage client GSTINs, plans or trial durations?</p>
          <p className="text-muted-foreground">Override user subscription plans and adjust GSTIN capacity in real-time.</p>
        </div>
        <a
          href="/admin/subscriptions"
          className="rounded-xl brand-gradient px-4 py-2 font-bold text-white shadow hover:brightness-110"
        >
          Manage Subscriptions &rarr;
        </a>
      </div>
      <AdminUsersPanel />
    </div>
  );
}
