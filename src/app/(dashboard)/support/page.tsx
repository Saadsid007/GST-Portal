import type { Metadata } from "next";
import { requireSession } from "@/features/auth";
import { listTicketsForUser } from "@/features/support/services/support.service";
import { MyTickets } from "@/features/support/presentation/my-tickets";
import { Badge, PageHeader } from "@/components/ui";
import { ShieldCheck } from "lucide-react";

export const metadata: Metadata = { title: "Help & Support — GSTPilot" };

export default async function SupportPage() {
  const session = await requireSession();
  const tickets = await listTicketsForUser(session.user.id);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Help & Support Desk"
        title="Customer Support & Inquiries"
        description="Direct assistance for GSTR-1 filings, marketplace report conversions, wallet credits, and GSTIN management with dedicated priority queues."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="success"
              size="md"
              className="bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/30 dark:text-emerald-400"
            >
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              Helpdesk Live (Mon–Sat 9AM–8PM IST)
            </Badge>
            <Badge variant="primary" size="md" className="hidden sm:inline-flex">
              <ShieldCheck className="size-3.5 text-primary-ink" aria-hidden />
              SLA: &lt; 2hr Response
            </Badge>
          </div>
        }
      />
      <MyTickets tickets={tickets} userEmail={session.user.email} />
    </div>
  );
}
