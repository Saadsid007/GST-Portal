"use client";

import { useEffect, useState, useTransition } from "react";
import {
  adminAdjustGstinCapacityAction,
  adminChangeUserPlanAction,
  adminExpireSubscriptionAction,
  adminExtendSubscriptionAction,
  adminGetBillingStatsAction,
  adminGetSubscribersListAction,
  adminResetTrialAction,
  type AdminBillingStats,
  type AdminSubscriberItem,
} from "@/features/billing/actions/admin-subscription.actions";
import { PLANS, type PlanSlug } from "@/features/billing/config/pricing.config";
import {
  Users,
  Search,
  Zap,
  TrendingUp,
  ShieldCheck,
  RotateCcw,
  Plus,
  Minus,
  Calendar,
  Loader2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Sliders,
  X,
  CreditCard,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export function AdminSubscriptionsPanel() {
  const [stats, setStats] = useState<AdminBillingStats | null>(null);
  const [items, setItems] = useState<AdminSubscriberItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [loading, startTransition] = useTransition();
  const [actionPending, startAction] = useTransition();

  // Modals state
  const [selectedUser, setSelectedUser] = useState<AdminSubscriberItem | null>(null);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [capacityModalOpen, setCapacityModalOpen] = useState(false);
  const [extendModalOpen, setExtendModalOpen] = useState(false);

  // Form states for modals
  const [newPlanSlug, setNewPlanSlug] = useState<PlanSlug>("growth");
  const [newPlanDays, setNewPlanDays] = useState(30);
  const [capacityDelta, setCapacityDelta] = useState(5);
  const [extendDays, setExtendDays] = useState(30);
  const [adminNote, setAdminNote] = useState("");

  function loadData() {
    startTransition(async () => {
      const [statsRes, listRes] = await Promise.all([
        adminGetBillingStatsAction(),
        adminGetSubscribersListAction({
          search,
          planSlug: planFilter,
          status: statusFilter,
          page,
          limit: 15,
        }),
      ]);

      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data);
      }
      if (listRes.success && listRes.data) {
        setItems(listRes.data.items);
        setTotal(listRes.data.total);
        setTotalPages(listRes.data.totalPages);
      }
    });
  }

  useEffect(() => {
    loadData();
  }, [page, planFilter, statusFilter]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    loadData();
  }

  function handlePlanSubmit() {
    if (!selectedUser) return;
    startAction(async () => {
      const res = await adminChangeUserPlanAction({
        userId: selectedUser.userId,
        planSlug: newPlanSlug,
        durationDays: newPlanDays,
        note: adminNote,
      });
      if (res.success) {
        setPlanModalOpen(false);
        setSelectedUser(null);
        setAdminNote("");
        loadData();
      } else {
        alert(res.error || "Failed to change plan");
      }
    });
  }

  function handleCapacitySubmit() {
    if (!selectedUser) return;
    startAction(async () => {
      const res = await adminAdjustGstinCapacityAction({
        userId: selectedUser.userId,
        additionalGstins: capacityDelta,
        note: adminNote,
      });
      if (res.success) {
        setCapacityModalOpen(false);
        setSelectedUser(null);
        setAdminNote("");
        loadData();
      } else {
        alert(res.error || "Failed to adjust capacity");
      }
    });
  }

  function handleExtendSubmit() {
    if (!selectedUser) return;
    startAction(async () => {
      const res = await adminExtendSubscriptionAction({
        userId: selectedUser.userId,
        extendDays,
        note: adminNote,
      });
      if (res.success) {
        setExtendModalOpen(false);
        setSelectedUser(null);
        setAdminNote("");
        loadData();
      } else {
        alert(res.error || "Failed to extend subscription");
      }
    });
  }

  function handleResetTrial(user: AdminSubscriberItem) {
    if (!confirm(`Reset ${user.userName} (${user.userEmail}) to a fresh 30-Day Free Trial with 7 GSTINs?`)) {
      return;
    }
    startAction(async () => {
      const res = await adminResetTrialAction({ userId: user.userId });
      if (res.success) loadData();
      else alert(res.error || "Failed to reset trial");
    });
  }

  function handleExpire(user: AdminSubscriberItem) {
    if (!confirm(`Immediately expire subscription for ${user.userName} (${user.userEmail})?`)) {
      return;
    }
    startAction(async () => {
      const res = await adminExpireSubscriptionAction({ userId: user.userId });
      if (res.success) loadData();
      else alert(res.error || "Failed to expire subscription");
    });
  }

  return (
    <div className="space-y-8">
      {/* KPI Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-bold tracking-wider uppercase">Active Subscribers</span>
              <ShieldCheck className="size-4 text-emerald-500" />
            </div>
            <p className="mt-2 text-2xl font-black text-foreground">
              {stats.activeSubscribers}{" "}
              <span className="text-xs font-medium text-muted-foreground">/ {stats.totalUsers} users</span>
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {stats.trialUsers} on 30-day trial • {stats.expiredUsers} expired
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-bold tracking-wider uppercase">GSTIN Slots Allocated</span>
              <Sliders className="size-4 text-primary-ink" />
            </div>
            <p className="mt-2 text-2xl font-black text-primary-ink">
              {stats.totalGstinSlotsAllocated}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {stats.totalGstinProfilesUsed} client profiles actively used
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-bold tracking-wider uppercase">Total Platform Revenue</span>
              <CreditCard className="size-4 text-emerald-600" />
            </div>
            <p className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {formatCurrency(stats.totalRevenueRupees)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              From plan subscriptions &amp; add-on GSTIN packs
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-bold tracking-wider uppercase">Estimated MRR</span>
              <TrendingUp className="size-4 text-primary-ink" />
            </div>
            <p className="mt-2 text-2xl font-black text-foreground">
              {formatCurrency(stats.mrrEstimateRupees)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Current active monthly recurring run-rate
            </p>
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-border bg-background py-2 pr-4 pl-10 text-xs focus:border-primary focus:outline-none"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={planFilter}
            onChange={(e) => {
              setPlanFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground focus:outline-none"
          >
            <option value="ALL">All Plans</option>
            <option value="free_trial">30-Day Free Trial</option>
            <option value="starter">Starter (10 GSTIN)</option>
            <option value="growth">Growth (15 GSTIN)</option>
            <option value="business">Business (30 GSTIN)</option>
            <option value="ca_pro">CA Pro (75 GSTIN)</option>
            <option value="ca_firm">CA Firm (200 GSTIN)</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="TRIALING">Trialing</option>
            <option value="EXPIRED">Expired</option>
          </select>
        </div>
      </div>

      {/* Subscriber List Table */}
      <div className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold tracking-wide uppercase text-foreground">
              Subscribers &amp; Capacity Control ({total})
            </h3>
            <p className="text-xs text-muted-foreground">
              Directly override plans, grant extra GSTIN slots, extend duration, or reset trials for any user.
            </p>
          </div>
          {loading && <Loader2 className="size-4 animate-spin text-primary-ink" />}
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-secondary/30 font-bold text-muted-foreground">
              <tr>
                <th className="px-4 py-3.5">User</th>
                <th className="px-4 py-3.5">Plan</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">GSTIN Capacity</th>
                <th className="px-4 py-3.5">Renewal / End Date</th>
                <th className="px-4 py-3.5">Total Paid</th>
                <th className="px-4 py-3.5 text-right">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((user) => {
                const isTrial = user.status === "TRIALING";
                const isActive = user.status === "ACTIVE";
                const isExpired = user.status === "EXPIRED";

                return (
                  <tr key={user.userId} className="hover:bg-accent/40 transition">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-bold text-foreground">{user.userName}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">{user.userEmail}</p>
                      </div>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2.5 py-1 text-[11px] font-bold text-foreground">
                        {user.planName}
                      </span>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          <span className="size-1.5 rounded-full bg-emerald-500" /> Active
                        </span>
                      ) : isTrial ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400">
                          <Sparkles className="size-3" /> Trial ({user.daysRemaining}d)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-destructive">
                          <AlertTriangle className="size-3" /> Expired
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <div>
                        <p className="font-semibold text-foreground">
                          {user.usedGSTINs} / {user.totalCapacity} Slots
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          ({user.includedGSTINs} base + {user.additionalGSTINs} add-on)
                        </p>
                      </div>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="size-3" />
                        <span>
                          {new Date(user.endDate).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3 font-bold text-foreground whitespace-nowrap">
                      {formatCurrency(user.totalPaid)}
                    </td>

                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedUser(user);
                            setNewPlanSlug(user.planSlug);
                            setPlanModalOpen(true);
                          }}
                          className="rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-bold text-foreground transition hover:bg-accent hover:border-primary/40"
                        >
                          Plan
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedUser(user);
                            setCapacityDelta(5);
                            setCapacityModalOpen(true);
                          }}
                          className="rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-bold text-primary-ink transition hover:bg-primary/10 hover:border-primary/40"
                        >
                          +Capacity
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedUser(user);
                            setExtendDays(30);
                            setExtendModalOpen(true);
                          }}
                          className="rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-bold text-emerald-600 transition hover:bg-emerald-500/10 hover:border-emerald-500/40"
                        >
                          +Days
                        </button>

                        <button
                          type="button"
                          onClick={() => handleResetTrial(user)}
                          title="Reset 30-Day Free Trial"
                          className="rounded-lg border border-border bg-background p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                        >
                          <RotateCcw className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border pt-4 text-xs">
            <span className="text-muted-foreground">
              Showing page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="flex items-center gap-1 rounded-lg border border-border px-3 py-1 font-semibold disabled:opacity-40"
              >
                <ChevronLeft className="size-3.5" /> Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="flex items-center gap-1 rounded-lg border border-border px-3 py-1 font-semibold disabled:opacity-40"
              >
                Next <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 1. Change Plan Modal */}
      {planModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setPlanModalOpen(false)}
              className="absolute top-5 right-5 rounded-full p-1.5 text-muted-foreground hover:bg-secondary"
            >
              <X className="size-4" />
            </button>

            <h3 className="text-base font-bold text-foreground">Change User Plan</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Target: <span className="font-semibold text-foreground">{selectedUser.userName}</span> ({selectedUser.userEmail})
            </p>

            <div className="my-5 space-y-4 text-xs">
              <div>
                <label className="font-bold text-foreground">Select New Plan</label>
                <select
                  value={newPlanSlug}
                  onChange={(e) => setNewPlanSlug(e.target.value as PlanSlug)}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background p-2.5 font-semibold text-foreground focus:outline-none"
                >
                  <option value="free_trial">30-Day Free Trial (7 GSTINs, ₹0)</option>
                  <option value="starter">Starter Plan (10 GSTINs, ₹79)</option>
                  <option value="growth">Growth Plan (15 GSTINs, ₹129)</option>
                  <option value="business">Business Plan (30 GSTINs, ₹199)</option>
                  <option value="ca_pro">CA Pro Plan (75 GSTINs, ₹399)</option>
                  <option value="ca_firm">CA Firm Plan (200 GSTINs, ₹799)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-foreground">Validity Duration (Days)</label>
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={newPlanDays}
                  onChange={(e) => setNewPlanDays(parseInt(e.target.value, 10) || 30)}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background p-2.5 font-semibold text-foreground focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-foreground">Admin Note (Audit log)</label>
                <input
                  type="text"
                  placeholder="e.g. Manual upgrade requested by client"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background p-2.5 text-foreground focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPlanModalOpen(false)}
                className="w-1/2 rounded-xl border border-border py-2.5 text-xs font-bold text-foreground hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePlanSubmit}
                disabled={actionPending}
                className="flex w-1/2 items-center justify-center gap-1.5 rounded-xl brand-gradient py-2.5 text-xs font-bold text-white shadow hover:brightness-110 disabled:opacity-50"
              >
                {actionPending ? <Loader2 className="size-3.5 animate-spin" /> : "Apply Plan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Adjust GSTIN Capacity Modal */}
      {capacityModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setCapacityModalOpen(false)}
              className="absolute top-5 right-5 rounded-full p-1.5 text-muted-foreground hover:bg-secondary"
            >
              <X className="size-4" />
            </button>

            <h3 className="text-base font-bold text-foreground">Grant / Adjust GSTIN Capacity</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Target: <span className="font-semibold text-foreground">{selectedUser.userName}</span> ({selectedUser.userEmail})
            </p>

            <div className="my-5 space-y-4 text-xs">
              <div className="rounded-xl border border-border bg-background p-3">
                <div className="flex justify-between text-muted-foreground">
                  <span>Current Capacity:</span>
                  <span className="font-bold text-foreground">{selectedUser.totalCapacity} GSTINs</span>
                </div>
                <div className="flex justify-between text-muted-foreground mt-1">
                  <span>New Total Capacity:</span>
                  <span className="font-bold text-primary-ink">
                    {Math.max(selectedUser.includedGSTINs, selectedUser.totalCapacity + capacityDelta)} GSTINs
                  </span>
                </div>
              </div>

              <div>
                <label className="font-bold text-foreground">Slots to Add / Remove</label>
                <div className="mt-1.5 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setCapacityDelta((d) => d - 1)}
                    className="flex size-8 items-center justify-center rounded-lg border border-border text-foreground hover:bg-secondary"
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <input
                    type="number"
                    value={capacityDelta}
                    onChange={(e) => setCapacityDelta(parseInt(e.target.value, 10) || 0)}
                    className="w-20 rounded-xl border border-border bg-background p-2 text-center font-bold text-foreground focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setCapacityDelta((d) => d + 1)}
                    className="flex size-8 items-center justify-center rounded-lg border border-border text-foreground hover:bg-secondary"
                  >
                    <Plus className="size-3.5" />
                  </button>
                  <span className="text-muted-foreground">extra GSTINs</span>
                </div>
              </div>

              <div>
                <label className="font-bold text-foreground">Admin Note</label>
                <input
                  type="text"
                  placeholder="e.g. Granted promotional capacity pack"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background p-2.5 text-foreground focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCapacityModalOpen(false)}
                className="w-1/2 rounded-xl border border-border py-2.5 text-xs font-bold text-foreground hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCapacitySubmit}
                disabled={actionPending}
                className="flex w-1/2 items-center justify-center gap-1.5 rounded-xl brand-gradient py-2.5 text-xs font-bold text-white shadow hover:brightness-110 disabled:opacity-50"
              >
                {actionPending ? <Loader2 className="size-3.5 animate-spin" /> : "Save Capacity"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Extend Subscription Modal */}
      {extendModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setExtendModalOpen(false)}
              className="absolute top-5 right-5 rounded-full p-1.5 text-muted-foreground hover:bg-secondary"
            >
              <X className="size-4" />
            </button>

            <h3 className="text-base font-bold text-foreground">Extend Subscription Duration</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Target: <span className="font-semibold text-foreground">{selectedUser.userName}</span> ({selectedUser.userEmail})
            </p>

            <div className="my-5 space-y-4 text-xs">
              <div className="flex flex-wrap gap-2">
                {[7, 15, 30, 60, 90, 180].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setExtendDays(d)}
                    className={`rounded-lg border px-3 py-1.5 font-bold transition ${
                      extendDays === d
                        ? "border-primary bg-primary/10 text-primary-ink"
                        : "border-border bg-background text-foreground hover:bg-secondary"
                    }`}
                  >
                    +{d} Days
                  </button>
                ))}
              </div>

              <div>
                <label className="font-bold text-foreground">Custom Days</label>
                <input
                  type="number"
                  min={1}
                  value={extendDays}
                  onChange={(e) => setExtendDays(parseInt(e.target.value, 10) || 30)}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background p-2.5 font-semibold text-foreground focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-foreground">Admin Note</label>
                <input
                  type="text"
                  placeholder="e.g. Extended for client support resolution"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background p-2.5 text-foreground focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setExtendModalOpen(false)}
                className="w-1/2 rounded-xl border border-border py-2.5 text-xs font-bold text-foreground hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExtendSubmit}
                disabled={actionPending}
                className="flex w-1/2 items-center justify-center gap-1.5 rounded-xl brand-gradient py-2.5 text-xs font-bold text-white shadow hover:brightness-110 disabled:opacity-50"
              >
                {actionPending ? <Loader2 className="size-3.5 animate-spin" /> : `Extend +${extendDays} Days`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
