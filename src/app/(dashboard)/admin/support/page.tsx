import type { Metadata } from "next";
import Link from "next/link";
import { Inbox, MessageSquare } from "lucide-react";
import { requireAdmin } from "@/features/auth";
import { getTicketCounts, listTicketsForAdmin } from "@/features/support/services/support.service";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
  TICKET_STATUSES,
  type TicketPriority,
  type TicketStatus,
} from "@/features/support/domain/support.constants";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Support inbox · Admin" };

interface Props {
  searchParams: Promise<{ status?: string; source?: string }>;
}

export default async function AdminSupportPage({ searchParams }: Props) {
  await requireAdmin();
  const sp = await searchParams;

  const status = TICKET_STATUSES.includes(sp.status as TicketStatus)
    ? (sp.status as TicketStatus)
    : undefined;
  const source = sp.source === "CONTACT" || sp.source === "SUPPORT" ? sp.source : undefined;

  const [tickets, counts] = await Promise.all([
    listTicketsForAdmin({ status, source }),
    getTicketCounts(),
  ]);

  const filters = [
    { label: "All", href: "/admin/support", active: !status && !source },
    ...TICKET_STATUSES.map((s) => ({
      label: STATUS_LABEL[s],
      href: `/admin/support?status=${s}`,
      active: status === s,
    })),
    { label: "Contact form", href: "/admin/support?source=CONTACT", active: source === "CONTACT" },
    { label: "In-app", href: "/admin/support?source=SUPPORT", active: source === "SUPPORT" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Support inbox"
        description="Everything from the public contact form and in-app support requests, in one queue."
        actions={
          <Badge variant={counts.open > 0 ? "warning" : "success"} size="md" dot>
            {counts.open} needing action
          </Badge>
        }
      />

      <div className="scrollbar-none flex gap-1.5 overflow-x-auto pb-1">
        {filters.map((f) => (
          <Link
            key={f.href}
            href={f.href}
            className={`flex-shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              f.active
                ? "border-primary bg-primary/10 text-primary-ink"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {tickets.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Nothing here"
          description="No tickets match this filter. When someone writes in, it lands here."
        />
      ) : (
        <ul className="space-y-2">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link href={`/admin/support/${t.id}`}>
                <Card variant="solid" interactive className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={STATUS_TONE[t.status as TicketStatus] ?? "neutral"} dot>
                      {STATUS_LABEL[t.status as TicketStatus] ?? t.status}
                    </Badge>
                    {(t.priority === "HIGH" || t.priority === "URGENT") && (
                      <Badge variant="destructive" size="sm">
                        {PRIORITY_LABEL[t.priority as TicketPriority]}
                      </Badge>
                    )}
                    <span className="font-mono text-2xs text-muted-foreground">{t.reference}</span>
                    <Badge variant="neutral" size="sm">
                      {t.source === "CONTACT" ? "Contact" : "In-app"}
                    </Badge>
                    {t._count.replies > 0 && (
                      <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground">
                        <MessageSquare className="size-3" aria-hidden />
                        {t._count.replies}
                      </span>
                    )}
                    <span className="ml-auto text-2xs text-muted-foreground">
                      {t.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium">{t.subject}</p>
                  <p className="mt-0.5 text-2xs text-muted-foreground">
                    {t.name} · {t.email}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
