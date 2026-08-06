import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireSession } from "@/features/auth";
import { getTicketForUser } from "@/features/support/services/support.service";
import { TicketThread } from "@/features/support/presentation/ticket-thread";

export const metadata: Metadata = { title: "Support request" };

export default async function UserTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  // Scoped by userId inside the query, so another user's id simply 404s.
  const ticket = await getTicketForUser(session.user.id, id);
  if (!ticket) notFound();

  return (
    <div className="space-y-5">
      <Link
        href="/support"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        All requests
      </Link>
      <TicketThread ticket={ticket} mode="user" />
    </div>
  );
}
