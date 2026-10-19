import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/features/auth";
import { PageHeader } from "@/components/ui";
import { AdminUsersPanel } from "@/features/auth/presentation/admin-users-panel";

export const metadata: Metadata = { title: "Admin access · Admin" };

export default async function AdminAccessPage() {
  // Re-checked here as well as in the layout: a route segment must never rely
  // on an ancestor alone for authorisation.
  await requireAdmin();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Admin access"
        description="Who can open this admin panel. A change takes effect on their next click — the role is read from the database on every request, not from their session."
      />
      <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        Looking for a customer&apos;s plan, validity or contact details?{" "}
        <Link
          href="/admin/subscriptions"
          className="font-semibold text-primary-ink hover:underline"
        >
          Open Users &amp; plans
        </Link>
      </p>
      <AdminUsersPanel />
    </div>
  );
}
