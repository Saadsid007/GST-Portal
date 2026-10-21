"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Bug,
  FileSpreadsheet,
  Sparkles,
  MessageSquare,
  AlertCircle,
  Search,
  X,
  Globe,
  Send,
  Loader2,
  ChevronRight,
  Zap,
} from "lucide-react";
import { Badge, Button, EmptyState, Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  STATUS_LABEL,
  STATUS_TONE,
  PRIORITY_LABEL,
  type TicketStatus,
  type TicketPriority,
} from "@/features/support/domain/support.constants";
import { adminReplyAction, updateTicketAction } from "@/features/support/actions/support.actions";

export interface FeedbackItem {
  id: string;
  reference: string;
  subject: string;
  message: string;
  category: string;
  priority: string;
  status: string;
  name: string;
  email: string;
  referenceId: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count: { replies: number };
}

interface Props {
  feedback: FeedbackItem[];
  counts: {
    total: number;
    open: number;
    bugs: number;
    conversions: number;
    features: number;
  };
}

export function AdminFeedbackManager({ feedback, counts }: Props) {
  const router = useRouter();
  const [overrides, setOverrides] = useState<Record<string, Partial<FeedbackItem>>>({});
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<FeedbackItem | null>(null);

  // Detail drawer / reply states
  const [replyBody, setReplyBody] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Derive items with optimistic overrides applied
  const items = useMemo(() => {
    return feedback.map((item) => {
      const override = overrides[item.id];
      return override ? { ...item, ...override } : item;
    });
  }, [feedback, overrides]);

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Category filter
      if (categoryFilter !== "ALL" && item.category !== categoryFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== "ALL") {
        if (statusFilter === "NEEDS_ACTION") {
          if (item.status === "RESOLVED" || item.status === "CLOSED") return false;
        } else if (item.status !== statusFilter) {
          return false;
        }
      }

      // Search filter
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        const matchesSub = item.subject.toLowerCase().includes(q);
        const matchesMsg = item.message.toLowerCase().includes(q);
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesEmail = item.email.toLowerCase().includes(q);
        const matchesRef = item.reference.toLowerCase().includes(q);
        const matchesUrl = item.referenceId?.toLowerCase().includes(q) ?? false;
        if (
          !matchesSub &&
          !matchesMsg &&
          !matchesName &&
          !matchesEmail &&
          !matchesRef &&
          !matchesUrl
        ) {
          return false;
        }
      }

      return true;
    });
  }, [items, categoryFilter, statusFilter, searchQuery]);

  // Quick status update
  async function handleStatusChange(ticketId: string, newStatus: TicketStatus) {
    setUpdatingStatus(true);
    const res = await updateTicketAction({ ticketId, status: newStatus });
    setUpdatingStatus(false);
    if (res.success) {
      toast.success(`Status updated to ${STATUS_LABEL[newStatus]}`);
      setOverrides((prev) => ({
        ...prev,
        [ticketId]: { ...prev[ticketId], status: newStatus },
      }));
      if (selectedItem?.id === ticketId) {
        setSelectedItem((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
      router.refresh();
    } else {
      toast.error(res.error ?? "Failed to update status");
    }
  }

  // Quick priority update
  async function handlePriorityChange(ticketId: string, newPriority: TicketPriority) {
    setUpdatingStatus(true);
    const res = await updateTicketAction({ ticketId, priority: newPriority });
    setUpdatingStatus(false);
    if (res.success) {
      toast.success(`Priority updated to ${PRIORITY_LABEL[newPriority]}`);
      setOverrides((prev) => ({
        ...prev,
        [ticketId]: { ...prev[ticketId], priority: newPriority },
      }));
      if (selectedItem?.id === ticketId) {
        setSelectedItem((prev) => (prev ? { ...prev, priority: newPriority } : null));
      }
      router.refresh();
    } else {
      toast.error(res.error ?? "Failed to update priority");
    }
  }

  // Admin reply / note
  async function handleSendReply() {
    if (!selectedItem || replyBody.trim().length < 2) return;
    setSendingReply(true);
    const res = await adminReplyAction({
      ticketId: selectedItem.id,
      body: replyBody.trim(),
      isInternal,
    });
    setSendingReply(false);
    if (res.success) {
      toast.success(isInternal ? "Internal team note added" : "Reply emailed to client");
      setReplyBody("");
      router.refresh();
    } else {
      toast.error(res.error ?? "Failed to send reply");
    }
  }

  function getCategoryMeta(cat: string) {
    switch (cat) {
      case "BUG":
        return {
          label: "Breaking Bug",
          icon: Bug,
          badgeColor: "border-rose-500/30 bg-rose-500/15 text-rose-700 dark:text-rose-300",
        };
      case "CONVERSION":
        return {
          label: "Marketplace File Error",
          icon: FileSpreadsheet,
          badgeColor: "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300",
        };
      case "FEATURE":
        return {
          label: "Feature Request",
          icon: Sparkles,
          badgeColor: "border-purple-500/30 bg-purple-500/15 text-purple-700 dark:text-purple-300",
        };
      default:
        return {
          label: "General Feedback",
          icon: MessageSquare,
          badgeColor: "border-blue-500/30 bg-blue-500/15 text-blue-700 dark:text-blue-300",
        };
    }
  }

  return (
    <div className="space-y-7">
      {/* ── Top Highlight Metric Cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Total Feedback Items */}
        <div className="relative overflow-hidden rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-500/[0.12] via-indigo-500/[0.04] to-card p-5 shadow-xs transition-all hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 dark:from-blue-950/60 dark:via-indigo-950/30 dark:to-card/90">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-extrabold tracking-wider text-blue-700 uppercase dark:text-blue-300">
              Total In-App Feedback
            </span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 ring-1 ring-blue-500/30 dark:bg-blue-500/25 dark:text-blue-400">
              <MessageSquare className="size-4.5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-foreground tabular-nums">
              {counts.total}
            </span>
            <span className="text-xs font-semibold text-muted-foreground">Logged</span>
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3 text-blue-500" />
            Submitted via floating sticky feedback button
          </p>
        </div>

        {/* 2. Critical & Bugs */}
        <div className="relative overflow-hidden rounded-2xl border border-rose-500/30 bg-gradient-to-br from-rose-500/[0.12] via-pink-500/[0.04] to-card p-5 shadow-xs transition-all hover:border-rose-500/50 hover:shadow-lg hover:shadow-rose-500/10 dark:from-rose-950/60 dark:via-pink-950/30 dark:to-card/90">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-extrabold tracking-wider text-rose-700 uppercase dark:text-rose-300">
              Breaking Bugs &amp; Issues
            </span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-rose-500/15 text-rose-600 ring-1 ring-rose-500/30 dark:bg-rose-500/25 dark:text-rose-400">
              <Bug className="size-4.5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-rose-950 tabular-nums dark:text-rose-100">
              {counts.bugs}
            </span>
            <span className="text-xs font-semibold text-rose-700 dark:text-rose-300">
              Urgent / High
            </span>
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-rose-700/85 dark:text-rose-300/85">
            <span className="size-2 animate-pulse rounded-full bg-rose-500" />
            Client reported crashes &amp; roadblocks
          </p>
        </div>

        {/* 3. Marketplace File Errors */}
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/[0.12] via-orange-500/[0.04] to-card p-5 shadow-xs transition-all hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/10 dark:from-amber-950/60 dark:via-orange-950/30 dark:to-card/90">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-extrabold tracking-wider text-amber-700 uppercase dark:text-amber-300">
              Marketplace Anomalies
            </span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 ring-1 ring-amber-500/30 dark:bg-amber-500/25 dark:text-amber-400">
              <FileSpreadsheet className="size-4.5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-amber-950 tabular-nums dark:text-amber-100">
              {counts.conversions}
            </span>
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
              File Errors
            </span>
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-amber-700/85 dark:text-amber-300/85">
            <AlertCircle className="size-3 text-amber-500" />
            Amazon, Flipkart &amp; Meesho format issues
          </p>
        </div>

        {/* 4. Feature & Change Requests */}
        <div className="relative overflow-hidden rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-500/[0.12] via-violet-500/[0.04] to-card p-5 shadow-xs transition-all hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10 dark:from-purple-950/60 dark:via-violet-950/30 dark:to-card/90">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-extrabold tracking-wider text-purple-700 uppercase dark:text-purple-300">
              Feature Requests
            </span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-purple-500/15 text-purple-600 ring-1 ring-purple-500/30 dark:bg-purple-500/25 dark:text-purple-400">
              <Sparkles className="size-4.5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-purple-950 tabular-nums dark:text-purple-100">
              {counts.features}
            </span>
            <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">
              Ideas Logged
            </span>
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-purple-700/85 dark:text-purple-300/85">
            <Zap className="size-3 text-purple-500" />
            Direct client requests for roadmap prioritization
          </p>
        </div>
      </div>

      {/* ── Filter Controls & Search ── */}
      <div className="space-y-3">
        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex flex-wrap gap-1 rounded-2xl border border-border bg-muted/30 p-1.5">
            {[
              { id: "ALL", label: "All Feedback", count: items.length },
              {
                id: "BUG",
                label: "🚨 Breaking Bugs",
                count: items.filter((i) => i.category === "BUG").length,
              },
              {
                id: "CONVERSION",
                label: "⚡ File Issues",
                count: items.filter((i) => i.category === "CONVERSION").length,
              },
              {
                id: "FEATURE",
                label: "💡 Feature Requests",
                count: items.filter((i) => i.category === "FEATURE").length,
              },
              {
                id: "FEEDBACK",
                label: "💬 General",
                count: items.filter((i) => i.category === "FEEDBACK").length,
              },
            ].map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setCategoryFilter(pill.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all",
                  categoryFilter === pill.id
                    ? "bg-card text-foreground shadow-xs ring-1 ring-border/80"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span>{pill.label}</span>
                <span className="py-0.2 rounded-full bg-muted px-1.5 text-[10px] font-black">
                  {pill.count}
                </span>
              </button>
            ))}
          </div>

          {/* Status Tabs */}
          <div className="inline-flex rounded-xl border border-border bg-muted/20 p-1 text-xs">
            {[
              { id: "ALL", label: "All Statuses" },
              { id: "NEEDS_ACTION", label: "Needing Action" },
              { id: "IN_PROGRESS", label: "In Progress" },
              { id: "RESOLVED", label: "Resolved" },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStatusFilter(st.id)}
                className={cn(
                  "rounded-lg px-2.5 py-1 font-bold transition-all",
                  statusFilter === st.id
                    ? "bg-card text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative w-full">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search feedback by subject, description, client email, or detected URL…"
            prefixNode={<Search className="size-4 text-muted-foreground" />}
            suffixNode={
              searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              ) : undefined
            }
            className="h-10 text-xs"
          />
        </div>
      </div>

      {/* ── FEEDBACK DATA TABLE ── */}
      {filteredItems.length === 0 ? (
        <EmptyState
          icon={Bug}
          title="No client feedback records found"
          description={
            searchQuery
              ? `No feedback matching "${searchQuery}". Clear your search or filters.`
              : "No feedback submitted matching the current filters. Reports from the sticky feedback widget will appear here in real-time."
          }
          action={
            searchQuery ? (
              <Button size="sm" variant="outline" onClick={() => setSearchQuery("")}>
                Clear Search
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-blue-500/25 bg-card shadow-sm">
          <table className="w-full min-w-[900px] text-left text-[14px]">
            {/* Dark Attractive Bluish Table Header */}
            <thead className="border-b border-blue-500/30 bg-gradient-to-r from-[#0B132B] via-[#111C3A] to-[#1C2541] text-xs font-bold tracking-wider text-blue-100 uppercase shadow-xs dark:from-[#080E1E] dark:via-[#0F1932] dark:to-[#0A1224]">
              <tr>
                <th className="px-4.5 py-3.5">Category</th>
                <th className="px-4.5 py-3.5">Priority</th>
                <th className="px-4.5 py-3.5">Subject &amp; Issue Summary</th>
                <th className="px-4.5 py-3.5">Detected Page URL</th>
                <th className="px-4.5 py-3.5">Client &amp; Contact</th>
                <th className="px-4.5 py-3.5">Status</th>
                <th className="px-4.5 py-3.5">Date</th>
                <th className="px-4.5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredItems.map((item, idx) => {
                const isAlternate = idx % 2 === 1;
                const meta = getCategoryMeta(item.category);
                const Icon = meta.icon;

                return (
                  <tr
                    key={item.id}
                    className={cn(
                      "transition-colors hover:bg-blue-500/[0.06] dark:hover:bg-blue-400/[0.08]",
                      isAlternate ? "bg-slate-500/[0.035] dark:bg-slate-400/[0.04]" : "bg-card",
                      (item.priority === "URGENT" || item.priority === "HIGH") &&
                        item.status === "OPEN" &&
                        "border-l-4 border-l-rose-500"
                    )}
                  >
                    {/* Category */}
                    <td className="px-4.5 py-3.5">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold",
                          meta.badgeColor
                        )}
                      >
                        <Icon className="size-3.5" />
                        <span>{meta.label}</span>
                      </span>
                    </td>

                    {/* Priority */}
                    <td className="px-4.5 py-3.5">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-md px-2 py-0.5 text-2xs font-extrabold tracking-wide uppercase",
                          item.priority === "URGENT"
                            ? "animate-pulse bg-rose-500/20 text-rose-700 ring-1 ring-rose-500/40 dark:text-rose-300"
                            : item.priority === "HIGH"
                              ? "bg-amber-500/20 text-amber-700 ring-1 ring-amber-500/40 dark:text-amber-300"
                              : "bg-muted text-muted-foreground"
                        )}
                      >
                        {item.priority}
                      </span>
                    </td>

                    {/* Subject */}
                    <td className="max-w-[280px] px-4.5 py-3.5">
                      <button
                        type="button"
                        onClick={() => setSelectedItem(item)}
                        className="group block text-left"
                      >
                        <p className="truncate font-bold text-foreground group-hover:text-primary">
                          {item.subject}
                        </p>
                        <p className="mt-0.5 font-mono text-2xs text-muted-foreground">
                          {item.reference}
                        </p>
                      </button>
                    </td>

                    {/* Detected Page URL */}
                    <td className="px-4.5 py-3.5">
                      {item.referenceId ? (
                        <span className="inline-flex max-w-[170px] items-center gap-1 truncate rounded-md bg-muted/60 px-2 py-0.5 font-mono text-2xs font-semibold text-foreground">
                          <Globe className="size-3 shrink-0 text-muted-foreground" />
                          <span className="truncate">{item.referenceId.replace("URL: ", "")}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Client */}
                    <td className="px-4.5 py-3.5">
                      <div>
                        <p className="text-xs font-bold text-foreground">{item.name}</p>
                        <p className="max-w-[160px] truncate font-mono text-2xs text-muted-foreground">
                          {item.email}
                        </p>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4.5 py-3.5">
                      <Badge
                        variant={STATUS_TONE[item.status as TicketStatus] ?? "neutral"}
                        dot
                        className="px-2.5 py-1 text-xs font-bold"
                      >
                        {STATUS_LABEL[item.status as TicketStatus] ?? item.status}
                      </Badge>
                    </td>

                    {/* Date */}
                    <td className="px-4.5 py-3.5 text-xs whitespace-nowrap text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>

                    {/* Action */}
                    <td className="px-4.5 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedItem(item)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground shadow-2xs transition hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
                      >
                        <span>Triage &amp; Resolve</span>
                        <ChevronRight className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── DETAIL DRAWER / MODAL ── */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-md transition-opacity"
            onClick={() => setSelectedItem(null)}
          />

          <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-blue-500/30 bg-card p-6 shadow-2xl ring-1 ring-border sm:p-7 dark:border-blue-500/35">
            <button
              type="button"
              onClick={() => setSelectedItem(null)}
              className="absolute top-5 right-5 rounded-xl border border-border bg-muted/40 p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>

            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-wrap items-center gap-2 border-b border-border/80 pr-10 pb-4">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold",
                    getCategoryMeta(selectedItem.category).badgeColor
                  )}
                >
                  {getCategoryMeta(selectedItem.category).label}
                </span>

                <span className="rounded-lg bg-blue-500/10 px-2 py-0.5 font-mono text-xs font-bold text-blue-700 dark:text-blue-300">
                  {selectedItem.reference}
                </span>

                <Badge
                  variant={STATUS_TONE[selectedItem.status as TicketStatus] ?? "neutral"}
                  dot
                  className="px-2.5 py-1 text-xs font-bold"
                >
                  {STATUS_LABEL[selectedItem.status as TicketStatus] ?? selectedItem.status}
                </Badge>

                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(selectedItem.createdAt).toLocaleString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              {/* Subject & Full Issue Description */}
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-foreground">{selectedItem.subject}</h3>
                <div className="rounded-2xl border border-border bg-muted/30 p-4.5 text-xs leading-relaxed whitespace-pre-wrap text-foreground">
                  {selectedItem.message}
                </div>
              </div>

              {/* Detected Origin Context & Client Profile */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* Client info */}
                <div className="space-y-1 rounded-2xl border border-border bg-card p-4">
                  <p className="text-2xs font-extrabold tracking-wider text-muted-foreground uppercase">
                    Sender Information
                  </p>
                  <p className="text-sm font-bold text-foreground">{selectedItem.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{selectedItem.email}</p>
                </div>

                {/* Page info */}
                <div className="space-y-1 rounded-2xl border border-border bg-card p-4">
                  <p className="text-2xs font-extrabold tracking-wider text-muted-foreground uppercase">
                    Origin Context
                  </p>
                  <p className="truncate font-mono text-xs font-bold text-foreground">
                    {selectedItem.referenceId || "No specific URL passed"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Auto-captured from customer session
                  </p>
                </div>
              </div>

              {/* ── Quick Status Changer ── */}
              <div className="space-y-2 rounded-2xl border border-blue-500/20 bg-blue-500/[0.04] p-4">
                <p className="text-2xs font-extrabold tracking-wider text-muted-foreground uppercase">
                  Update Resolution Status
                </p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      "OPEN",
                      "IN_PROGRESS",
                      "WAITING_ON_USER",
                      "RESOLVED",
                      "CLOSED",
                    ] as TicketStatus[]
                  ).map((st) => (
                    <button
                      key={st}
                      type="button"
                      disabled={updatingStatus}
                      onClick={() => handleStatusChange(selectedItem.id, st)}
                      className={cn(
                        "rounded-xl px-3 py-1.5 text-xs font-bold transition-all disabled:opacity-50",
                        selectedItem.status === st
                          ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs"
                          : "border border-border bg-card text-foreground hover:bg-muted"
                      )}
                    >
                      {STATUS_LABEL[st]}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Quick Priority Changer ── */}
              <div className="space-y-2">
                <p className="text-2xs font-extrabold tracking-wider text-muted-foreground uppercase">
                  Update Urgency
                </p>
                <div className="flex flex-wrap gap-2">
                  {(["LOW", "NORMAL", "HIGH", "URGENT"] as TicketPriority[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      disabled={updatingStatus}
                      onClick={() => handlePriorityChange(selectedItem.id, p)}
                      className={cn(
                        "rounded-xl px-3 py-1.5 text-xs font-bold transition-all disabled:opacity-50",
                        selectedItem.priority === p
                          ? p === "URGENT" || p === "HIGH"
                            ? "bg-rose-600 text-white shadow-xs"
                            : "bg-blue-600 text-white shadow-xs"
                          : "border border-border bg-card text-foreground hover:bg-muted"
                      )}
                    >
                      {PRIORITY_LABEL[p]}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Reply / Note Composer ── */}
              <div className="space-y-3 border-t border-border/80 pt-5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold tracking-wider text-foreground uppercase">
                    Send Client Update or Log Internal Note
                  </h4>
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                      className="size-3.5 accent-amber-500"
                    />
                    <span>Internal Note (Client won&apos;t see)</span>
                  </label>
                </div>

                <textarea
                  rows={3}
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder={
                    isInternal
                      ? "Add internal developer notes, commit hashes, or investigation progress…"
                      : "Write response to be emailed directly to the client…"
                  }
                  className="w-full rounded-2xl border border-border bg-background p-3.5 text-xs leading-relaxed font-medium transition focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
                />

                <div className="flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedItem(null)}
                    className="rounded-xl border border-border px-4 py-2 text-xs font-bold transition hover:bg-muted"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    disabled={sendingReply || replyBody.trim().length < 2}
                    onClick={handleSendReply}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/25 transition hover:brightness-110 disabled:opacity-50"
                  >
                    {sendingReply ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Send className="size-3.5" />
                    )}
                    <span>{isInternal ? "Save Internal Note" : "Send Response to Client"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
