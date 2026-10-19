"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Loader2,
  Search,
  ShieldCheck,
  Sliders,
  TrendingUp,
} from "lucide-react";
import {
  adminGetBillingStatsAction,
  adminGetSubscribersListAction,
  type AdminBillingStats,
  type AdminSubscriberItem,
} from "@/features/billing/actions/admin-subscription.actions";
import { getAllPlans } from "@/features/billing/config/pricing.config";
import { formatIndianMobile } from "@/features/auth/domain/phone";
import { Badge } from "@/components/ui";
import { cn, formatCurrency, formatDate, formatRelative } from "@/lib/utils";
import { AdminUserProfileDialog } from "./admin-user-profile-dialog";

const PAGE_SIZE = 15;

function StatusBadge({ user }: { user: AdminSubscriberItem }) {
  if (user.deleted) return <Badge variant="destructive">Deleted</Badge>;
  if (user.status === "ACTIVE")
    return (
      <Badge variant="success" dot>
        Active
      </Badge>
    );
  if (user.status === "TRIALING")
    return (
      <Badge variant="info" dot>
        Trial · {user.daysRemaining}d
      </Badge>
    );
  if (user.status === "EXPIRED") return <Badge variant="destructive">Expired</Badge>;
  return <Badge>{user.status}</Badge>;
}

function Stat({
  label,
  icon: Icon,
  value,
  hint,
}: {
  label: string;
  icon: typeof ShieldCheck;
  value: React.ReactNode;
  hint: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-2xs font-semibold tracking-wider uppercase">{label}</span>
        <Icon className="size-4" aria-hidden />
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-foreground tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

/**
 * Every account on the platform: who they are, what they are on, until when.
 * A row opens the full profile, where the changes are made.
 */
export function AdminSubscriptionsPanel() {
  const [stats, setStats] = useState<AdminBillingStats | null>(null);
  const [items, setItems] = useState<AdminSubscriberItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [planFilter, setPlanFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [openUserId, setOpenUserId] = useState<string | null>(null);
  const [loading, startTransition] = useTransition();

  const loadData = useCallback(() => {
    startTransition(async () => {
      const [statsRes, listRes] = await Promise.all([
        adminGetBillingStatsAction(),
        adminGetSubscribersListAction({
          search: query,
          planSlug: planFilter,
          status: statusFilter,
          page,
          limit: PAGE_SIZE,
        }),
      ]);
      if (statsRes.success && statsRes.data) setStats(statsRes.data);
      if (listRes.success && listRes.data) {
        setItems(listRes.data.items);
        setTotal(listRes.data.total);
        setTotalPages(Math.max(1, listRes.data.totalPages));
      } else if (!listRes.success) {
        toast.error(listRes.error ?? "Could not load users");
      }
    });
  }, [query, planFilter, statusFilter, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="space-y-5">
      {stats && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label="Paying"
            icon={ShieldCheck}
            value={
              <>
                {stats.activeSubscribers}
                <span className="ml-1 text-xs font-medium text-muted-foreground">
                  / {stats.totalUsers} users
                </span>
              </>
            }
            hint={`${stats.trialUsers} on trial · ${stats.expiredUsers} expired`}
          />
          <Stat
            label="GSTINs in use"
            icon={Sliders}
            value={stats.totalGstinProfilesUsed}
            hint={`${stats.totalGstinSlotsAllocated} slots allocated`}
          />
          <Stat
            label="Revenue"
            icon={CreditCard}
            value={formatCurrency(stats.totalRevenueRupees)}
            hint="All successful payments"
          />
          <Stat
            label="Monthly run-rate"
            icon={TrendingUp}
            value={formatCurrency(stats.mrrEstimateRupees)}
            hint="Active paid plans"
          />
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 md:flex-row md:items-center">
        <form
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setQuery(search.trim());
          }}
        >
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search name, email or mobile — press Enter"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-input bg-background py-2 pr-3 pl-9 text-sm focus:border-ring focus:ring-2 focus:ring-ring/30 focus:outline-none"
          />
        </form>
        <div className="flex gap-2">
          <select
            value={planFilter}
            onChange={(e) => {
              setPlanFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
            aria-label="Filter by plan"
          >
            <option value="ALL">All plans</option>
            {getAllPlans().map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
            aria-label="Filter by status"
          >
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="TRIALING">Trial</option>
            <option value="EXPIRED">Expired</option>
            <option value="DELETED">Deleted accounts</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">
            {statusFilter === "DELETED" ? "Deleted accounts" : "Users"}{" "}
            <span className="font-normal text-muted-foreground">({total})</span>
          </p>
          {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-border bg-subtle text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-2.5">User</th>
                <th className="px-4 py-2.5">Plan</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">GSTINs</th>
                <th className="px-4 py-2.5">Valid till</th>
                <th className="px-4 py-2.5">Last active</th>
                <th className="px-4 py-2.5 text-right">Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No users match these filters.
                  </td>
                </tr>
              )}
              {items.map((user) => (
                <tr
                  key={user.userId}
                  onClick={() => setOpenUserId(user.userId)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setOpenUserId(user.userId);
                    }
                  }}
                  tabIndex={0}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none",
                    user.deleted && "opacity-70"
                  )}
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold text-foreground">
                      {user.userName}
                      {user.role === "ADMIN" && (
                        <Badge variant="primary" className="ml-1.5">
                          Admin
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{user.userEmail}</p>
                    {user.phone && (
                      <p className="text-xs text-muted-foreground">
                        {formatIndianMobile(user.phone)}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{user.planName}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge user={user} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                    {user.usedGSTINs} / {user.totalCapacity}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatDate(user.endDate)}
                    {!user.deleted && user.status !== "EXPIRED" && (
                      <span className="block text-xs text-muted-foreground">
                        {user.daysRemaining} days left
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {formatRelative(user.lastActive)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold whitespace-nowrap tabular-nums">
                    {formatCurrency(user.totalPaid)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs">
            <span className="text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 font-semibold disabled:opacity-40"
              >
                <ChevronLeft className="size-3.5" /> Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 font-semibold disabled:opacity-40"
              >
                Next <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      <AdminUserProfileDialog
        key={openUserId ?? "none"}
        userId={openUserId}
        onClose={() => setOpenUserId(null)}
        onChanged={loadData}
      />
    </div>
  );
}
