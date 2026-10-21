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
        <Card
          variant="solid"
          className="overflow-hidden rounded-2xl border border-blue-500/25 p-5 shadow-xs"
        >
          <div className="mb-3.5 flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
            <Badge
              variant={STATUS_TONE[ticket.status as TicketStatus] ?? "neutral"}
              dot
              className="px-2.5 py-1 text-xs font-bold"
            >
              {STATUS_LABEL[ticket.status as TicketStatus] ?? ticket.status}
            </Badge>
            <span className="rounded-lg bg-blue-500/10 px-2 py-0.5 font-mono text-xs font-bold text-blue-700 dark:text-blue-300">
              {ticket.reference}
            </span>
            <span className="ml-auto text-xs text-muted-foreground">
              {ticket.createdAt.toLocaleString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <h2 className="text-base font-bold text-foreground">{ticket.subject}</h2>
          <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {ticket.message}
          </p>
          {ticket.referenceId && (
            <div className="mt-3.5 inline-flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3.5 py-2 font-mono text-xs text-foreground">
              <span className="font-semibold text-muted-foreground">Payment / Ref ID:</span>
              <span className="font-bold text-primary-ink">{ticket.referenceId}</span>
            </div>
          )}
        </Card>

        {/* Thread */}
        {ticket.replies.map((r) => (
          <Card
            key={r.id}
            variant={r.isInternal ? "dashed" : "solid"}
            className={cn(
              "rounded-2xl p-5 shadow-xs transition-all",
              r.isFromAdmin &&
                !r.isInternal &&
                "border-blue-500/30 bg-gradient-to-br from-blue-500/[0.06] via-indigo-500/[0.02] to-card",
              r.isInternal && "border-amber-500/30 bg-amber-500/[0.05]"
            )}
          >
            <div className="mb-2 flex items-center gap-2.5 border-b border-border/40 pb-2">
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-xl text-xs font-bold ring-1",
                  r.isFromAdmin
                    ? "bg-blue-600 text-white shadow-xs ring-blue-500/30"
                    : "bg-muted text-muted-foreground ring-border"
                )}
              >
                {r.isFromAdmin ? (
                  <ShieldCheck className="size-4" aria-hidden />
                ) : (
                  <User className="size-4" aria-hidden />
                )}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-foreground">{r.authorName}</span>
                {r.isFromAdmin && (
                  <span className="py-0.2 rounded-full bg-blue-500/15 px-2 text-[10px] font-extrabold text-blue-700 dark:text-blue-300">
                    GSTPilot Support Team
                  </span>
                )}
              </div>
              {r.isInternal && (
                <Badge variant="warning" size="sm">
                  <EyeOff className="size-3" aria-hidden />
                  Internal note
                </Badge>
              )}
              <span className="ml-auto text-xs text-muted-foreground">
                {r.createdAt.toLocaleString("en-IN", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">{r.body}</p>
          </Card>
        ))}

        {/* Composer */}
        {closed ? (
          <Card variant="subtle" className="flex items-center gap-3 rounded-2xl p-5">
            <Lock className="size-5 flex-shrink-0 text-muted-foreground" aria-hidden />
            <p className="text-xs text-muted-foreground">
              This ticket is resolved and closed.{" "}
              {mode === "user" && "Need further help? You can raise a new inquiry anytime."}
            </p>
          </Card>
        ) : (
          <Card
            variant="solid"
            className="space-y-4 rounded-2xl border border-blue-500/20 p-5 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                {mode === "admin" ? "Post Support Response" : "Write Reply or Add Details"}
              </h3>
              <span className="text-[11px] text-muted-foreground">Markdown supported</span>
            </div>
            <Textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={
                mode === "admin"
                  ? "Explain resolution steps, schema corrections, or transaction sync status…"
                  : "Provide additional details, UPI reference, or confirmation…"
              }
              className="text-xs"
            />
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              {mode === "admin" ? (
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={internal}
                    onChange={(e) => setInternal(e.target.checked)}
                    className="size-3.5 accent-[hsl(var(--warning))]"
                  />
                  Internal note — customer will not see this
                </label>
              ) : (
                <span className="text-2xs text-muted-foreground">
                  Our team replies during standard support hours.
                </span>
              )}
              <Button
                size="sm"
                loading={sending}
                onClick={send}
                disabled={body.trim().length < 2}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 px-4 py-2 font-bold text-white shadow-md shadow-blue-500/25 transition hover:brightness-110"
              >
                <Send className="size-3.5" />
                <span>{internal ? "Save Internal Note" : "Send Response"}</span>
              </Button>
            </div>
          </Card>
        )}
      </div>

      {/* Meta / controls */}
      <aside className="space-y-4 lg:sticky lg:top-24">
        <Card
          variant="subtle"
          className="space-y-3 rounded-2xl border border-border p-4.5 text-xs shadow-2xs"
        >
          <p className="border-b border-border/60 pb-2 text-2xs font-extrabold tracking-wider text-muted-foreground uppercase">
            Ticket Metadata
          </p>
          <Meta label="Requester" value={ticket.name} />
          <Meta label="Email" value={ticket.email} mono />
          <Meta label="Category" value={ticket.category.replace("_", " ")} />
          <Meta
            label="Priority"
            value={PRIORITY_LABEL[ticket.priority as TicketPriority] ?? ticket.priority}
          />
          <Meta
            label="Channel"
            value={ticket.source === "CONTACT" ? "Public Portal" : "Authenticated App"}
          />
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
