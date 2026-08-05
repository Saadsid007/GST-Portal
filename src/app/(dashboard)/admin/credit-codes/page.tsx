import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/features/auth";
import { getAdminBillingConfigAction } from "@/features/billing/actions/admin.actions";
import { PageHeader } from "@/components/ui";
import { AdminBillingSections } from "@/features/billing/presentation/admin-billing-panel";

export const metadata: Metadata = { title: "Credit codes · Admin" };

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
        title="Credit codes"
        description="Issue promotional codes that grant wallet credits on redemption, and revoke them without deleting the redemption history."
      />
      <AdminBillingSections sections={["creditCodes"]} initialConfig={result.data} />
    </div>
  );
}
