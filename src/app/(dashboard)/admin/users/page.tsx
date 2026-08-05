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
      <AdminUsersPanel />
    </div>
  );
}
