"use client";

import { useState, useEffect, useTransition, useId } from "react";
import { toast } from "sonner";
import {
  Users,
  Mail,
  Download,
  Send,
  RefreshCw,
  Search,
  CheckCircle2,
  Sparkles,
  Loader2,
  Filter,
  X,
} from "lucide-react";
import {
  adminGetMarketingAudienceAction,
  adminExportAudienceCsvAction,
  adminSendBroadcastCampaignAction,
  adminSyncAllUsersToMarketingAction,
  type MarketingAudienceItem,
  type MarketingAudienceStats,
} from "../actions/marketing.actions";

export function AdminCampaignsMarketingPanel() {
  const [items, setItems] = useState<MarketingAudienceItem[]>([]);
  const [stats, setStats] = useState<MarketingAudienceStats>({
    totalSubscribers: 0,
    freeTrialSubscribers: 0,
    paidSubscribers: 0,
    unsubscribed: 0,
  });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [search, setSearch] = useState("");
  const [planSlug, setPlanSlug] = useState("ALL");
  const [status, setStatus] = useState("ALL");

  const [isPending, startTransition] = useTransition();
  const [isExporting, setIsExporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Broadcast Modal State
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [headline, setHeadline] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [targetAudience, setTargetAudience] = useState<"ALL" | "TRIAL" | "PAID" | "EXPIRED">("ALL");
  const [ctaText, setCtaText] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [isSending, setIsSending] = useState(false);

  const searchInputId = useId();
  const planSelectId = useId();
  const statusSelectId = useId();
  const broadcastTargetId = useId();
  const broadcastSubjectId = useId();
  const broadcastHeadlineId = useId();
  const broadcastBodyId = useId();
  const broadcastCtaTextId = useId();
  const broadcastCtaUrlId = useId();

  const loadData = () => {
    startTransition(async () => {
      const res = await adminGetMarketingAudienceAction({
        search,
        planSlug,
        status,
        page,
        limit: 20,
      });

      if (res.success && res.data) {
        setItems(res.data.items);
        setStats(res.data.stats);
        setTotal(res.data.total);
        setTotalPages(res.data.totalPages);
      } else {
        toast.error(res.error || "Failed to load marketing audience");
      }
    });
  };

  useEffect(() => {
    loadData();
  }, [page, planSlug, status]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadData();
  };

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const res = await adminExportAudienceCsvAction({ status, planSlug });
      if (res.success && res.csvContent && res.filename) {
        const blob = new Blob([res.csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", res.filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Marketing audience CSV downloaded successfully");
      } else {
        toast.error(res.error || "Failed to export CSV");
      }
    } catch {
      toast.error("Failed to export CSV");
    } finally {
      setIsExporting(false);
    }
  };

  const handleSyncUsers = async () => {
    setIsSyncing(true);
    try {
      const res = await adminSyncAllUsersToMarketingAction();
      if (res.success) {
        toast.success(`Successfully synced ${res.syncedCount} users into marketing audience!`);
        loadData();
      } else {
        toast.error(res.error || "Failed to sync users");
      }
    } catch {
      toast.error("Failed to sync users");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !headline.trim() || !bodyText.trim()) {
      toast.error("Please fill in Subject, Headline and Message Body");
      return;
    }

    setIsSending(true);
    try {
      const res = await adminSendBroadcastCampaignAction({
        subject,
        headline,
        bodyText,
        targetAudience,
        ctaText: ctaText.trim() || undefined,
        ctaUrl: ctaUrl.trim() || undefined,
      });

      if (res.success) {
        toast.success(`Broadcast dispatched successfully to ${res.recipientCount} recipients!`);
        setIsBroadcastOpen(false);
        setSubject("");
        setHeadline("");
        setBodyText("");
        setCtaText("");
        setCtaUrl("");
      } else {
        toast.error(res.error || "Failed to dispatch broadcast");
      }
    } catch {
      toast.error("Broadcast failed to send");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── KPI Stat Cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Users className="size-4 text-primary" /> Total Contacts
          </div>
          <div className="mt-2 text-2xl font-black">{stats.totalSubscribers}</div>
          <div className="mt-0.5 text-2xs text-muted-foreground">Syncs from signups & leads</div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Sparkles className="size-4 text-emerald-500" /> Active Paid
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-500">{stats.paidSubscribers}</div>
          <div className="mt-0.5 text-2xs text-muted-foreground">Subscribed paid customers</div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Mail className="size-4 text-amber-500" /> 30-Day Free Trials
          </div>
          <div className="mt-2 text-2xl font-black text-amber-500">{stats.freeTrialSubscribers}</div>
          <div className="mt-0.5 text-2xs text-muted-foreground">Active trial users (7 GSTINs)</div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <CheckCircle2 className="size-4 text-blue-500" /> Ready for Outreach
          </div>
          <div className="mt-2 text-2xl font-black text-blue-500">
            {stats.totalSubscribers - stats.unsubscribed}
          </div>
          <div className="mt-0.5 text-2xs text-muted-foreground">Opted-in reachable emails</div>
        </div>
      </div>

      {/* ── Audience Controls Bar ── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearch} className="flex flex-1 items-center gap-2">
          <div className="relative flex-1">
            <label htmlFor={searchInputId} className="sr-only">Search contacts</label>
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              id={searchInputId}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by email or name..."
              className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-xs transition focus:ring-2 focus:ring-primary/50 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor={planSelectId} className="sr-only">Filter by plan</label>
            <select
              id={planSelectId}
              value={planSlug}
              onChange={(e) => {
                setPlanSlug(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by plan"
              className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold focus:outline-none"
            >
              <option value="ALL">All Plans</option>
              <option value="free_trial">30-Day Free Trial</option>
              <option value="PAID">Any Paid Plan</option>
              <option value="starter">Starter</option>
              <option value="growth">Growth</option>
              <option value="business">Business</option>
              <option value="ca_pro">CA Pro</option>
              <option value="ca_firm">CA Firm</option>
            </select>

            <label htmlFor={statusSelectId} className="sr-only">Filter by status</label>
            <select
              id={statusSelectId}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by status"
              className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="SUBSCRIBED">Subscribed</option>
              <option value="UNSUBSCRIBED">Unsubscribed</option>
            </select>
          </div>
        </form>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isSyncing}
            onClick={handleSyncUsers}
            title="Import/sync any existing users into the marketing database"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold transition hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            Sync Users
          </button>

          <button
            type="button"
            disabled={isExporting}
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold transition hover:bg-accent disabled:opacity-50"
          >
            {isExporting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            Export CSV
          </button>

          <button
            type="button"
            onClick={() => setIsBroadcastOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl brand-gradient px-4 py-2 text-xs font-bold text-white shadow hover:brightness-110"
          >
            <Send className="size-3.5" /> Broadcast Email
          </button>
        </div>
      </div>

      {/* ── Audience Table ── */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-xs">
            <thead className="border-b border-border bg-muted/40 font-bold text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Contact / User</th>
                <th className="px-4 py-3 text-left">Plan Tier</th>
                <th className="px-4 py-3 text-left">Audience Source</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Joined Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isPending ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="mx-auto size-6 animate-spin text-primary" />
                    <p className="mt-2 text-xs">Loading marketing contacts...</p>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground">
                    <Mail className="mx-auto size-8 opacity-40" />
                    <p className="mt-2 font-semibold">No contacts found</p>
                    <p className="text-2xs">Click &quot;Sync Users&quot; to auto-import existing registered accounts.</p>
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-foreground">{item.name || "Unnamed"}</div>
                      <div className="font-mono text-muted-foreground">{item.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          item.planSlug === "free_trial"
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {item.planSlug.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-2xs text-muted-foreground">{item.source}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          item.status === "SUBSCRIBED"
                            ? "bg-blue-500/10 text-blue-500"
                            : "bg-red-500/10 text-red-500"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <div>
              Showing {items.length} of {total} contacts
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || isPending}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-border px-2.5 py-1 hover:bg-accent disabled:opacity-50"
              >
                Previous
              </button>
              <span className="font-semibold text-foreground">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages || isPending}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-border px-2.5 py-1 hover:bg-accent disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Broadcast Email Modal Dialog ── */}
      {isBroadcastOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h2 className="text-lg font-bold">Compose Campaign Broadcast</h2>
                <p className="text-xs text-muted-foreground">
                  Send a styled marketing or update announcement to your user base.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsBroadcastOpen(false)}
                className="rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSendBroadcast} className="mt-4 space-y-4 text-xs">
              <div className="space-y-1">
                <label htmlFor={broadcastTargetId} className="font-bold text-muted-foreground uppercase">
                  Target Audience
                </label>
                <select
                  id={broadcastTargetId}
                  value={targetAudience}
                  onChange={(e) =>
                    setTargetAudience(e.target.value as "ALL" | "TRIAL" | "PAID" | "EXPIRED")
                  }
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold focus:outline-none"
                >
                  <option value="ALL">All Active Subscribers ({stats.totalSubscribers})</option>
                  <option value="TRIAL">30-Day Free Trial Users ({stats.freeTrialSubscribers})</option>
                  <option value="PAID">Active Paid Customers ({stats.paidSubscribers})</option>
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor={broadcastSubjectId} className="font-bold text-muted-foreground uppercase">
                  Email Subject Line
                </label>
                <input
                  id={broadcastSubjectId}
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Special Offer: 20% Off CA Pro Plan for GST Filing Season"
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm transition focus:ring-2 focus:ring-primary/50 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor={broadcastHeadlineId} className="font-bold text-muted-foreground uppercase">
                  Header Banner / Headline
                </label>
                <input
                  id={broadcastHeadlineId}
                  type="text"
                  required
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="e.g. File All Your Marketplace Returns 5x Faster"
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm transition focus:ring-2 focus:ring-primary/50 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor={broadcastBodyId} className="font-bold text-muted-foreground uppercase">
                  Message Body (Separate paragraphs with blank lines)
                </label>
                <textarea
                  id={broadcastBodyId}
                  rows={6}
                  required
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  placeholder="Write your email announcement message here..."
                  className="w-full rounded-xl border border-border bg-background p-3 text-sm transition focus:ring-2 focus:ring-primary/50 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label htmlFor={broadcastCtaTextId} className="font-bold text-muted-foreground uppercase">
                    CTA Button Text (Optional)
                  </label>
                  <input
                    id={broadcastCtaTextId}
                    type="text"
                    value={ctaText}
                    onChange={(e) => setCtaText(e.target.value)}
                    placeholder="e.g. Upgrade Now"
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm transition focus:ring-2 focus:ring-primary/50 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor={broadcastCtaUrlId} className="font-bold text-muted-foreground uppercase">
                    CTA Button URL (Optional)
                  </label>
                  <input
                    id={broadcastCtaUrlId}
                    type="text"
                    value={ctaUrl}
                    onChange={(e) => setCtaUrl(e.target.value)}
                    placeholder="e.g. https://gstpilot.com/pricing"
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm transition focus:ring-2 focus:ring-primary/50 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setIsBroadcastOpen(false)}
                  className="rounded-xl border border-border px-4 py-2 font-bold hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSending}
                  className="inline-flex items-center gap-2 rounded-xl brand-gradient px-5 py-2 font-bold text-white shadow hover:brightness-110 disabled:opacity-50"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Dispatching Broadcast...
                    </>
                  ) : (
                    <>
                      <Send className="size-4" /> Send Campaign Now
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
