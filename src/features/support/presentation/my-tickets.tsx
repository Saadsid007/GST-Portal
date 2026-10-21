"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  LifeBuoy,
  MessageSquare,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Headphones,
  Mail,
  Copy,
  Check,
  ArrowRight,
  ShieldCheck,
  FileQuestion,
  Search,
  X,
  Sparkles,
  Zap,
  HelpCircle,
  FileSpreadsheet,
} from "lucide-react";
import { Badge, Button, Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  STATUS_LABEL,
  STATUS_TONE,
  type TicketStatus,
} from "@/features/support/domain/support.constants";
import { RaiseRequestDialog } from "@/features/support/presentation/raise-request-dialog";

export interface TicketRow {
  id: string;
  reference: string;
  subject: string;
  category: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  _count: { replies: number };
}

interface Props {
  tickets: TicketRow[];
  userEmail?: string;
}

export function MyTickets({ tickets, userEmail: _userEmail }: Props) {
  const [raising, setRaising] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "RESOLVED">("ALL");
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const openTickets = useMemo(
    () =>
      tickets.filter(
        (t) => t.status === "OPEN" || t.status === "IN_PROGRESS" || t.status === "WAITING_ON_USER"
      ),
    [tickets]
  );

  const resolvedTickets = useMemo(
    () => tickets.filter((t) => t.status === "RESOLVED" || t.status === "CLOSED"),
    [tickets]
  );

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      // Status filter
      if (statusFilter === "ACTIVE") {
        if (
          ticket.status !== "OPEN" &&
          ticket.status !== "IN_PROGRESS" &&
          ticket.status !== "WAITING_ON_USER"
        ) {
          return false;
        }
      } else if (statusFilter === "RESOLVED") {
        if (ticket.status !== "RESOLVED" && ticket.status !== "CLOSED") {
          return false;
        }
      }

      // Search filter
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        const matchesRef = ticket.reference.toLowerCase().includes(q);
        const matchesSub = ticket.subject.toLowerCase().includes(q);
        const matchesCat = ticket.category.toLowerCase().includes(q);
        if (!matchesRef && !matchesSub && !matchesCat) return false;
      }

      return true;
    });
  }, [tickets, statusFilter, searchQuery]);

  function copySupportEmail() {
    navigator.clipboard.writeText("support@gstpilot.com");
    setCopiedEmail(true);
    toast.success("Official support email copied to clipboard");
    setTimeout(() => setCopiedEmail(false), 2000);
  }

  const quickGuides = [
    {
      title: "Wallet & UPI Auto-Credit Delay",
      badge: "Payment & Credits",
      icon: Zap,
      gradient: "from-blue-500/10 via-indigo-500/5 to-card border-blue-500/30",
      accent: "text-blue-500 dark:text-blue-400 bg-blue-500/15 ring-blue-500/30",
      solution:
        "UPI payments typically sync in under 60 seconds via Razorpay webhook. If pending after 3 minutes, raise a ticket with your 12-digit UPI RRN reference number for instant manual sync.",
    },
    {
      title: "Amazon / Flipkart / Meesho Reports",
      badge: "File Formatting",
      icon: FileSpreadsheet,
      gradient: "from-emerald-500/10 via-teal-500/5 to-card border-emerald-500/30",
      accent: "text-emerald-500 dark:text-emerald-400 bg-emerald-500/15 ring-emerald-500/30",
      solution:
        "Upload raw monthly tax report exports. Do not alter column headers or remove empty sheets. GSTPilot automatically extracts B2B, B2CS, credit notes, and state-wise aggregates.",
    },
    {
      title: "GSTR-1 JSON Schema Error (RET11401)",
      badge: "Compliance & Filing",
      icon: AlertCircle,
      gradient: "from-amber-500/10 via-orange-500/5 to-card border-amber-500/30",
      accent: "text-amber-500 dark:text-amber-400 bg-amber-500/15 ring-amber-500/30",
      solution:
        "Ensure all HSN codes have either 6 or 8 numeric digits as mandated by CBIC guidelines, and that recipient POS state code exactly matches the first 2 digits of the customer's GSTIN.",
    },
    {
      title: "Client GSTIN Capacity & Multi-State",
      badge: "Account Limits",
      icon: ShieldCheck,
      gradient: "from-purple-500/10 via-violet-500/5 to-card border-purple-500/30",
      accent: "text-purple-500 dark:text-purple-400 bg-purple-500/15 ring-purple-500/30",
      solution:
        "Each active client or distinct state GSTIN occupies 1 slot. Upgrade slots anytime in Billing. You can also archive older seasonal GSTINs without losing historical filings.",
    },
  ];

  return (
    <div className="space-y-7">
      {/* ── Top Highlight Stat Cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Total Raised Inquiries */}
        <div className="relative overflow-hidden rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-500/[0.12] via-indigo-500/[0.04] to-card p-5 shadow-xs transition-all hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 dark:from-blue-950/60 dark:via-indigo-950/30 dark:to-card/90">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-extrabold tracking-wider text-blue-700 uppercase dark:text-blue-300">
              Support Inquiries
            </span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 ring-1 ring-blue-500/30 dark:bg-blue-500/25 dark:text-blue-400">
              <LifeBuoy className="size-4.5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-foreground tabular-nums">
              {tickets.length}
            </span>
            <span className="text-xs font-semibold text-muted-foreground">Total Logged</span>
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3 text-blue-500" />
            Tracked end-to-end to verified closure
          </p>
        </div>

        {/* 2. Active / In Progress */}
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/[0.12] via-orange-500/[0.04] to-card p-5 shadow-xs transition-all hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/10 dark:from-amber-950/60 dark:via-orange-950/30 dark:to-card/90">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-extrabold tracking-wider text-amber-700 uppercase dark:text-amber-300">
              Active / In Progress
            </span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 ring-1 ring-amber-500/30 dark:bg-amber-500/25 dark:text-amber-400">
              <AlertCircle className="size-4.5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-amber-950 tabular-nums dark:text-amber-100">
              {openTickets.length}
            </span>
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
              Awaiting Action
            </span>
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-amber-700/85 dark:text-amber-300/85">
            <span className="size-2 animate-pulse rounded-full bg-amber-500" />
            Dedicated tax &amp; tech desk assigned
          </p>
        </div>

        {/* 3. Resolved Requests */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.12] via-teal-500/[0.04] to-card p-5 shadow-xs transition-all hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/10 dark:from-emerald-950/60 dark:via-teal-950/30 dark:to-card/90">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-extrabold tracking-wider text-emerald-700 uppercase dark:text-emerald-300">
              Successfully Resolved
            </span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/30 dark:bg-emerald-500/25 dark:text-emerald-400">
              <CheckCircle2 className="size-4.5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-foreground tabular-nums">
              {resolvedTickets.length}
            </span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              Closed &amp; Verified
            </span>
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Check className="size-3 text-emerald-500" />
            100% verified customer resolution
          </p>
        </div>

        {/* 4. Priority Turnaround SLA */}
        <div className="relative overflow-hidden rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-500/[0.12] via-violet-500/[0.04] to-card p-5 shadow-xs transition-all hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10 dark:from-purple-950/60 dark:via-violet-950/30 dark:to-card/90">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-extrabold tracking-wider text-purple-700 uppercase dark:text-purple-300">
              Turnaround SLA
            </span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-purple-500/15 text-purple-600 ring-1 ring-purple-500/30 dark:bg-purple-500/25 dark:text-purple-400">
              <Clock className="size-4.5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-purple-950 dark:text-purple-100">
              &lt; 2 Hours
            </span>
            <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">
              Average
            </span>
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-purple-700/85 dark:text-purple-300/85">
            <ShieldCheck className="size-3 text-purple-500" />
            Priority response across all 7 days
          </p>
        </div>
      </div>

      {/* ── Official Direct Support Channels Hero Banner ── */}
      <div className="relative overflow-hidden rounded-3xl border border-blue-500/30 bg-gradient-to-r from-blue-600/[0.09] via-indigo-600/[0.05] to-card p-6 shadow-sm dark:from-blue-950/50 dark:via-indigo-950/30 dark:to-card/90">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/30">
              <Headphones className="size-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="text-base font-bold text-foreground">
                  Official GSTPilot Technical &amp; Compliance Helpdesk
                </h3>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-2xs font-extrabold text-emerald-700 dark:text-emerald-400">
                  <span className="size-1.5 animate-ping rounded-full bg-emerald-500" />
                  Live Mon–Sat 9AM–8PM IST
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                Get high-priority direct assistance with marketplace reports (Amazon, Flipkart,
                Meesho), GSTIN profile limits, UPI wallet sync, and GSTR-1 government schema
                anomalies.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={copySupportEmail}
                  className="group inline-flex items-center gap-2 rounded-xl border border-blue-500/30 bg-card px-3 py-1.5 font-mono font-semibold text-foreground shadow-2xs transition hover:border-blue-500 hover:bg-blue-500/10"
                >
                  <Mail className="size-3.5 text-primary-ink" />
                  <span>support@gstpilot.com</span>
                  {copiedEmail ? (
                    <Check className="size-3 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Copy className="size-3 text-muted-foreground group-hover:text-primary" />
                  )}
                </button>
                <span className="text-muted-foreground/60">·</span>
                <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
                  <ShieldCheck className="size-3.5 text-emerald-500" />
                  Chartered Accountant (CA) escalation lane enabled
                </span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <Button
              size="md"
              onClick={() => setRaising(true)}
              className="group flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-500/25 transition-all hover:shadow-blue-500/35 hover:brightness-110"
            >
              <Plus className="size-4 transition-transform group-hover:rotate-90" />
              <span>Raise Support Ticket</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ── Interactive Instant Self-Help Guides & FAQs ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HelpCircle className="size-4 text-primary-ink" />
            <h3 className="text-sm font-bold text-foreground">
              Instant Self-Service Troubleshooting
            </h3>
          </div>
          <span className="text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
            Common Solutions Before Submitting
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-4">
          {quickGuides.map((guide, idx) => {
            const Icon = guide.icon;
            const isOpen = activeFaq === idx;

            return (
              <div
                key={guide.title}
                onClick={() => setActiveFaq(isOpen ? null : idx)}
                className={cn(
                  "cursor-pointer rounded-2xl border p-4 shadow-2xs transition-all hover:shadow-md",
                  guide.gradient,
                  isOpen && "shadow-sm ring-2 ring-primary/40"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div
                    className={cn(
                      "flex size-8 items-center justify-center rounded-xl ring-1",
                      guide.accent
                    )}
                  >
                    <Icon className="size-4" />
                  </div>
                  <span className="rounded-md bg-muted/60 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                    {guide.badge}
                  </span>
                </div>
                <h4 className="mt-2.5 line-clamp-1 text-xs font-bold text-foreground">
                  {guide.title}
                </h4>
                <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                  {guide.solution}
                </p>
                <button
                  type="button"
                  className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                >
                  <span>{isOpen ? "Hide Details" : "Read Solution"}</span>
                  <ArrowRight
                    className={cn("size-3 transition-transform", isOpen && "rotate-90")}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── TICKETS DATA TABLE & CONTROLS ── */}
      <div className="space-y-4">
        {/* Controls: Filter Tabs, Search & Count */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex rounded-xl border border-border bg-muted/30 p-1">
            <button
              type="button"
              onClick={() => setStatusFilter("ALL")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
                statusFilter === "ALL"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span>All Tickets</span>
              <span className="py-0.2 rounded-full bg-muted px-1.5 text-[10px] font-extrabold">
                {tickets.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("ACTIVE")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
                statusFilter === "ACTIVE"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="size-1.5 rounded-full bg-amber-500" />
              <span>In Progress</span>
              <span className="py-0.2 rounded-full bg-amber-500/15 px-1.5 text-[10px] font-extrabold text-amber-700 dark:text-amber-300">
                {openTickets.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("RESOLVED")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
                statusFilter === "RESOLVED"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Check className="size-3 text-emerald-500" />
              <span>Resolved</span>
              <span className="py-0.2 rounded-full bg-emerald-500/15 px-1.5 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400">
                {resolvedTickets.length}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="relative w-full sm:w-64">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search reference, subject…"
                prefixNode={<Search className="size-3.5 text-muted-foreground" />}
                suffixNode={
                  searchQuery ? (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3" />
                    </button>
                  ) : undefined
                }
                className="h-9 text-xs"
              />
            </div>
            <Button
              size="sm"
              onClick={() => setRaising(true)}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 px-3.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:brightness-110"
            >
              <Plus className="size-3.5" />
              <span>New Ticket</span>
            </Button>
          </div>
        </div>

        {/* Table / Empty State */}
        {filteredTickets.length === 0 ? (
          <div className="relative overflow-hidden rounded-3xl border border-dashed border-border bg-gradient-to-b from-card to-muted/20 p-12 text-center shadow-xs">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 ring-1 ring-blue-500/20 dark:text-blue-400">
              <LifeBuoy className="size-7" />
            </div>
            <h3 className="text-base font-bold text-foreground">
              {searchQuery ? "No matching support tickets" : "No Support Requests Yet"}
            </h3>
            <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-muted-foreground">
              {searchQuery
                ? `No support tickets match "${searchQuery}". Clear your search or filter.`
                : "Need help with file conversion, UPI payments, GSTIN capacity or GSTR-1 error codes? Raise a ticket and our engineering team will resolve it quickly."}
            </p>
            <div className="mt-5 flex justify-center gap-3">
              {searchQuery ? (
                <Button size="sm" variant="outline" onClick={() => setSearchQuery("")}>
                  Clear Search
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => setRaising(true)}
                  className="rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/25"
                >
                  <Plus className="mr-1.5 size-4" />
                  Raise Your First Ticket
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-blue-500/25 bg-card shadow-sm">
            <table className="w-full min-w-[800px] text-left text-[14px]">
              {/* Dark Attractive Bluish Table Header */}
              <thead className="border-b border-blue-500/30 bg-gradient-to-r from-[#0B132B] via-[#111C3A] to-[#1C2541] text-xs font-bold tracking-wider text-blue-100 uppercase shadow-xs dark:from-[#080E1E] dark:via-[#0F1932] dark:to-[#0A1224]">
                <tr>
                  <th className="px-4.5 py-3.5">Ticket ID</th>
                  <th className="px-4.5 py-3.5">Subject &amp; Issue Summary</th>
                  <th className="px-4.5 py-3.5">Category</th>
                  <th className="px-4.5 py-3.5">Status</th>
                  <th className="px-4.5 py-3.5 text-center">Responses</th>
                  <th className="px-4.5 py-3.5">Last Updated</th>
                  <th className="px-4.5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredTickets.map((t, i) => {
                  const isAlternate = i % 2 === 1;

                  return (
                    <tr
                      key={t.id}
                      className={cn(
                        "transition-colors hover:bg-blue-500/[0.06] dark:hover:bg-blue-400/[0.08]",
                        isAlternate ? "bg-slate-500/[0.035] dark:bg-slate-400/[0.04]" : "bg-card"
                      )}
                    >
                      {/* Reference */}
                      <td className="px-4.5 py-3.5 font-mono text-[14px] font-bold text-foreground">
                        <Link
                          href={`/support/${t.id}`}
                          className="hover:text-primary hover:underline"
                        >
                          {t.reference}
                        </Link>
                      </td>

                      {/* Subject */}
                      <td className="max-w-[320px] px-4.5 py-3.5">
                        <Link href={`/support/${t.id}`} className="group block">
                          <p className="truncate font-semibold text-foreground group-hover:text-primary">
                            {t.subject}
                          </p>
                        </Link>
                      </td>

                      {/* Category */}
                      <td className="px-4.5 py-3.5">
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary-ink capitalize">
                          <FileQuestion className="size-3" />
                          {t.category.toLowerCase().replace("_", " ")}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4.5 py-3.5">
                        <Badge
                          variant={STATUS_TONE[t.status as TicketStatus] ?? "neutral"}
                          dot
                          className="px-2.5 py-1 text-xs font-bold"
                        >
                          {STATUS_LABEL[t.status as TicketStatus] ?? t.status}
                        </Badge>
                      </td>

                      {/* Replies */}
                      <td className="px-4.5 py-3.5 text-center font-mono text-xs">
                        {t._count.replies > 0 ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-0.5 font-bold text-blue-700 ring-1 ring-blue-500/20 dark:bg-blue-500/20 dark:text-blue-300">
                            <MessageSquare className="size-3 text-blue-500" />
                            {t._count.replies}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Last Updated */}
                      <td className="px-4.5 py-3.5 text-xs font-medium text-muted-foreground">
                        {new Date(t.updatedAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>

                      {/* Action */}
                      <td className="px-4.5 py-3.5 text-right">
                        <Link
                          href={`/support/${t.id}`}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground shadow-2xs transition hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
                        >
                          <span>View Thread</span>
                          <ArrowRight className="size-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {raising && <RaiseRequestDialog onClose={() => setRaising(false)} />}
    </div>
  );
}
