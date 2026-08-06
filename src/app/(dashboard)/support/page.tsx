import type { Metadata } from "next";
import { requireSession } from "@/features/auth";
import { listTicketsForUser } from "@/features/support/services/support.service";
import { MyTickets } from "@/features/support/presentation/my-tickets";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Support" };

export default async function SupportPage() {
  const session = await requireSession();
  const tickets = await listTicketsForUser(session.user.id);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Help"
        title="Support"
        description="Raise an issue with payments, conversions or your account, and follow it through to resolution."
      />
      <MyTickets tickets={tickets} />
    </div>
  );
}
