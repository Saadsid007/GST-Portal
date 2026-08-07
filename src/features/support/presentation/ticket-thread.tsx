"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { EyeOff, Lock, Send, ShieldCheck, User } from "lucide-react";
import { Badge, Button, Card, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketPriority,
  type TicketStatus,
} from "@/features/support/domain/support.constants";
import {
  adminReplyAction,
  replyToTicketAction,
  updateTicketAction,
} from "@/features/support/actions/support.actions";

export interface ThreadReply {
  id: string;
  body: string;
  isFromAdmin: boolean;
  isInternal: boolean;
  authorName: string;
  createdAt: Date;
}

export interface ThreadTicket {
  id: string;
  reference: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  category: string;
  source: string;
  name: string;
  email: string;
  referenceId: string | null;
  createdAt: Date;
  replies: ThreadReply[];
}

/**
 * One thread component for both sides. `mode` decides who can post an internal
 * note and who can change status — the server actions enforce it again, this
 * only decides what is worth rendering.
 */
export function TicketThread({ ticket, mode }: { ticket: ThreadTicket; mode: "user" | "admin" }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);

  const closed = ticket.status === "CLOSED";

  async function send() {
    if (body.trim().length < 2) return;
    setSending(true);
    const res =
      mode === "admin"
        ? await adminReplyAction({ ticketId: ticket.id, body, isInternal: internal })
        : await replyToTicketAction({ ticketId: ticket.id, body });
    setSending(false);
    if (res.success) {
      setBody("");
      setInternal(false);
      toast.success(internal ? "Internal note added" : "Reply sent");
      router.refresh();
    } else {
      toast.error(res.error ?? "Could not send");
    }
  }

  async function update(patch: { status?: TicketStatus; priority?: TicketPriority }) {
    setBusy(true);
    const res = await updateTicketAction({ ticketId: ticket.id, ...patch });
    setBusy(false);
    if (res.success) {
      toast.success("Ticket updated");
      router.refresh();
    } else toast.error(res.error ?? "Could not update");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_16rem] lg:items-start">
      <div className="min-w-0 space-y-4">
        {/* Original message */}
        <Card variant="solid" className="p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant={STATUS_TONE[ticket.status as TicketStatus] ?? "neutral"} dot>
              {STATUS_LABEL[ticket.status as TicketStatus] ?? ticket.status}
            </Badge>
            <span className="font-mono text-2xs text-muted-foreground">{ticket.reference}</span>
            <span className="ml-auto text-2xs text-muted-foreground">
              {ticket.createdAt.toLocaleString("en-IN", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <h2 className="text-base font-semibold">{ticket.subject}</h2>
          <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {ticket.message}
          </p>
          {ticket.referenceId && (
            <p className="mt-3 rounded-lg bg-muted px-3 py-2 font-mono text-2xs">
              Reference: {ticket.referenceId}
            </p>
          )}
        </Card>

        {/* Thread */}
        {ticket.replies.map((r) => (
          <Card
            key={r.id}
            variant={r.isInternal ? "dashed" : "solid"}
            className={cn(
              "p-4",
              r.isFromAdmin && !r.isInternal && "border-primary/25 bg-primary/[0.04]",
              r.isInternal && "border-warning/30 bg-warning/[0.05]"
            )}
          >
            <div className="mb-1.5 flex items-center gap-2">
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-2xs",
                  r.isFromAdmin
                    ? "bg-primary/15 text-primary-ink"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {r.isFromAdmin ? (
                  <ShieldCheck className="size-3" aria-hidden />
                ) : (
                  <User className="size-3" aria-hidden />
                )}
              </span>
              <span className="text-xs font-semibold">{r.authorName}</span>
              {r.isInternal && (
                <Badge variant="warning" size="sm">
                  <EyeOff className="size-3" aria-hidden />
                  Internal note
                </Badge>
              )}
              <span className="ml-auto text-2xs text-muted-foreground">
                {r.createdAt.toLocaleString("en-IN", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{r.body}</p>
          </Card>
        ))}

        {/* Composer */}
        {closed ? (
          <Card variant="subtle" className="flex items-center gap-2 p-4">
            <Lock className="size-4 flex-shrink-0 text-muted-foreground" aria-hidden />
            <p className="text-xs text-muted-foreground">
              This ticket is closed.{" "}
              {mode === "user" && "Raise a new request if you still need help."}
            </p>
          </Card>
        ) : (
          <Card variant="solid" className="space-y-3 p-4">
            <Textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={
                mode === "admin" ? "Reply to the customer…" : "Add more detail or reply…"
              }
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              {mode === "admin" ? (
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={internal}
                    onChange={(e) => setInternal(e.target.checked)}
                    className="size-3.5 accent-[hsl(var(--warning))]"
                  />
                  Internal note — the customer never sees this
                </label>
              ) : (
                <span />
              )}
              <Button size="sm" loading={sending} onClick={send} disabled={body.trim().length < 2}>
                <Send />
                {internal ? "Add note" : "Send reply"}
              </Button>
            </div>
          </Card>
        )}
      </div>

      {/* Meta / controls */}
      <aside className="space-y-4 lg:sticky lg:top-24">
        <Card variant="subtle" className="space-y-2.5 p-4 text-xs">
          <Meta label="From" value={ticket.name} />
          <Meta label="Email" value={ticket.email} mono />
          <Meta label="Category" value={ticket.category} />
          <Meta
            label="Priority"
            value={PRIORITY_LABEL[ticket.priority as TicketPriority] ?? ticket.priority}
          />
          <Meta label="Source" value={ticket.source === "CONTACT" ? "Contact form" : "In-app"} />
        </Card>

        {mode === "admin" && (
          <Card variant="solid" className="space-y-3 p-4">
            <p className="text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
              Update status
            </p>
            <div className="flex flex-wrap gap-1.5">
              {TICKET_STATUSES.map((s) => (
                <Button
                  key={s}
                  size="xs"
                  variant={ticket.status === s ? "primary" : "outline"}
                  disabled={busy}
                  onClick={() => update({ status: s })}
                >
                  {STATUS_LABEL[s]}
                </Button>
              ))}
            </div>
            <p className="pt-1 text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
              Priority
            </p>
            <div className="flex flex-wrap gap-1.5">
              {TICKET_PRIORITIES.map((p) => (
                <Button
                  key={p}
                  size="xs"
                  variant={ticket.priority === p ? "primary" : "outline"}
                  disabled={busy}
                  onClick={() => update({ priority: p })}
                >
                  {PRIORITY_LABEL[p]}
                </Button>
              ))}
            </div>
          </Card>
        )}
      </aside>
    </div>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("min-w-0 truncate text-right font-medium", mono && "font-mono")}>
        {value}
      </span>
    </div>
  );
}
