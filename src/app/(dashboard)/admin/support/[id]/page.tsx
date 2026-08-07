import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/features/auth";
import { getTicketForAdmin } from "@/features/support/services/support.service";
import { TicketThread } from "@/features/support/presentation/ticket-thread";

export const metadata: Metadata = { title: "Ticket · Admin" };

export default async function AdminTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin();
  const ticket = await getTicketForAdmin(id);
  if (!ticket) notFound();

  return (
    <div className="space-y-5">
      <Link
        href="/admin/support"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Support inbox
      </Link>
      <TicketThread ticket={ticket} mode="admin" />
    </div>
  );
}
