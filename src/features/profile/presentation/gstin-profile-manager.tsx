"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Star,
  Building2,
  MapPin,
  Loader2,
  Search,
  X,
  AlertTriangle,
  Archive,
  RotateCcw,
  ArrowRight,
  Check,
  ShieldCheck,
  FileText,
  Copy,
  Sparkles,
} from "lucide-react";
import { filterGstinProfiles } from "@/features/profile/domain/gstin-search";
import { Button, EmptyState, Input, Modal } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { GstinProfile } from "@/generated/prisma/client";
import type {
  GSTINCapacityStatus,
  PermanentDeleteImpact,
} from "@/features/billing/services/capacity.service";
import { BUSINESS_TYPE_OPTIONS, businessTypeMeta } from "@/features/profile/domain/business-type";
import {
  addGstinProfileAction,
  archiveGstinProfileAction,
  restoreGstinProfileAction,
  permanentlyDeleteGstinProfileAction,
  getPermanentDeleteImpactAction,
  setDefaultGstinAction,
} from "@/features/profile/actions/profile.actions";

interface Props {
  initialActive: GstinProfile[];
  initialArchived: GstinProfile[];
  capacity: GSTINCapacityStatus;
}

const EMPTY_FORM = {
  gstinNumber: "",
  legalName: "",
  tradeName: "",
  businessType: "ECOMMERCE_SELLER",
  isDefault: false,
};

function ProfileIdentityCard({ profile, muted }: { profile: GstinProfile; muted?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-border p-3.5",
        muted ? "bg-muted/40" : "bg-subtle"
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background shadow-2xs">
        <Building2 className="size-4 text-muted-foreground" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[14px] font-semibold text-foreground">{profile.legalName}</p>
        <p className="mt-0.5 font-mono text-xs tracking-tight text-muted-foreground">
          {profile.gstinNumber}
        </p>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="size-3" aria-hidden />
          {profile.stateName} ({profile.stateCode})
        </p>
      </div>
    </div>
  );
}

function SlotFigure({
  label,
  from,
  to,
  highlight,
}: {
  label: string;
  from: number;
  to: number;
  highlight?: boolean;
}) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-0.5 flex items-baseline gap-1.5 tabular-nums">
        <span className="text-xs text-muted-foreground line-through">{from}</span>
        <span
          className={cn("text-lg font-black", highlight ? "text-success-ink" : "text-foreground")}
        >
          {to}
        </span>
      </p>
    </div>
  );
}

const OUTCOME_TONES = {
  success: "text-success-ink",
  warning: "text-warning-ink",
  neutral: "text-muted-foreground",
} as const;

function OutcomeRow({
  tone,
  icon: Icon,
  children,
}: {
  tone: keyof typeof OUTCOME_TONES;
  icon: typeof Check;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <Icon className={cn("mt-0.5 size-3.5 shrink-0", OUTCOME_TONES[tone])} aria-hidden />
      <span className="text-muted-foreground">{children}</span>
    </li>
  );
}

export function GstinProfileManager({ initialActive, initialArchived, capacity }: Props) {
  const [active, setActive] = useState(initialActive);
  const [archived, setArchived] = useState(initialArchived);
  const [cap, setCap] = useState(capacity);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"active" | "archived">("active");
  const [form, setForm] = useState(EMPTY_FORM);

  const [archiveTarget, setArchiveTarget] = useState<GstinProfile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    profile: GstinProfile;
    impact: PermanentDeleteImpact | null;
  } | null>(null);

  const atCapacity = cap.available <= 0;

  function copyGstin(gstin: string, id: string) {
    navigator.clipboard.writeText(gstin);
    setCopiedId(id);
    toast.success(`Copied ${gstin}`);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await addGstinProfileAction(form);
      if (res.success && res.data) {
        setActive((prev) => {
          const updated = form.isDefault ? prev.map((p) => ({ ...p, isDefault: false })) : prev;
          return [res.data!, ...updated];
        });
        setCap((c) => ({
          ...c,
          used: c.used + 1,
          activeProfiles: c.activeProfiles + 1,
          available: Math.max(0, c.available - 1),
        }));
        setForm(EMPTY_FORM);
        setShowForm(false);
        toast.success("GSTIN profile added successfully");
      } else {
        toast.error(res.error || "Failed to add profile");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function confirmArchive() {
    if (!archiveTarget) return;
    const target = archiveTarget;
    setBusyId(target.id);
    try {
      const res = await archiveGstinProfileAction(target.id);
      if (!res.success) {
        toast.error(res.error || "Failed to archive");
        return;
      }
      setActive((prev) => prev.filter((p) => p.id !== target.id));
      setArchived((prev) => [{ ...target, status: "ARCHIVED", isDefault: false }, ...prev]);
      if (res.capacity) setCap(res.capacity);
      setArchiveTarget(null);
      toast.success("Profile archived — slot freed. Historical data preserved.");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRestore(profile: GstinProfile) {
    setBusyId(profile.id);
    try {
      const res = await restoreGstinProfileAction(profile.id);
      if (!res.success) {
        toast.error(res.error || "Failed to restore");
        return;
      }
      setArchived((prev) => prev.filter((p) => p.id !== profile.id));
      setActive((prev) => [{ ...profile, status: "ACTIVE" }, ...prev]);
      if (res.capacity) setCap(res.capacity);
      toast.success("Profile restored to active");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  async function openDeleteDialog(profile: GstinProfile) {
    setDeleteTarget({ profile, impact: null });
    try {
      const res = await getPermanentDeleteImpactAction(profile.id);
      if (res.success && res.data) {
        setDeleteTarget({ profile, impact: res.data });
      } else {
        setDeleteTarget(null);
        toast.error(res.error || "Could not load profile");
      }
    } catch {
      setDeleteTarget(null);
      toast.error("Something went wrong");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const { profile } = deleteTarget;
    setBusyId(profile.id);
    try {
      const res = await permanentlyDeleteGstinProfileAction(profile.id);
      if (!res.success) {
        toast.error(res.error || "Failed to delete");
        return;
      }
      setArchived((prev) => prev.filter((p) => p.id !== profile.id));
      setDeleteTarget(null);
      toast.success("Profile permanently deleted. Filing history is preserved.");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  async function handleSetDefault(id: string) {
    const res = await setDefaultGstinAction(id);
    if (!res.success) {
      toast.error(res.error || "Failed to set default");
      return;
    }
    setActive((prev) => prev.map((p) => ({ ...p, isDefault: p.id === id })));
    toast.success("Primary default GSTIN updated");
  }

  const visibleActive = useMemo(() => filterGstinProfiles(active, query), [active, query]);
  const visibleArchived = useMemo(() => filterGstinProfiles(archived, query), [archived, query]);

  return (
    <div className="space-y-6">
      {/* ── Top Attractive Stat Cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Active GSTINs */}
        <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-500/[0.12] via-indigo-500/[0.04] to-card p-5 shadow-xs transition-all hover:border-blue-500/50 hover:shadow-md hover:shadow-blue-500/5 dark:from-blue-950/60 dark:via-indigo-950/30 dark:to-card/90">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              Active GSTINs
            </span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 ring-1 ring-blue-500/30 dark:bg-blue-500/25 dark:text-blue-400">
              <Building2 className="size-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black tracking-tight text-foreground tabular-nums sm:text-3xl">
              {cap.used}
            </span>
            <span className="text-xs font-semibold text-muted-foreground">
              / {cap.totalCapacity} total
            </span>
          </div>
          <p className="mt-1 text-xs font-medium text-muted-foreground">
            Client registrations consuming slots
          </p>
        </div>

        {/* 2. Available Free Slots */}
        <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.12] via-teal-500/[0.04] to-card p-5 shadow-xs transition-all hover:border-emerald-500/50 hover:shadow-md hover:shadow-emerald-500/5 dark:from-emerald-950/60 dark:via-teal-950/30 dark:to-card/90">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              Available Slots
            </span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/30 dark:bg-emerald-500/25 dark:text-emerald-400">
              <ShieldCheck className="size-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black tracking-tight text-foreground tabular-nums sm:text-3xl">
              {cap.available}
            </span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              Free to assign
            </span>
          </div>
          <p className="mt-1 text-xs font-medium text-muted-foreground">
            Ready for instant GSTIN onboarding
          </p>
        </div>

        {/* 3. Archived Preserved */}
        <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-500/[0.12] via-violet-500/[0.04] to-card p-5 shadow-xs transition-all hover:border-purple-500/50 hover:shadow-md hover:shadow-purple-500/5 dark:from-purple-950/60 dark:via-violet-950/30 dark:to-card/90">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wider text-purple-700 uppercase dark:text-purple-300">
              Archived Profiles
            </span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-purple-500/15 text-purple-600 ring-1 ring-purple-500/30 dark:bg-purple-500/25 dark:text-purple-400">
              <Archive className="size-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black tracking-tight text-purple-950 tabular-nums sm:text-3xl dark:text-purple-100">
              {cap.archivedProfiles}
            </span>
            <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
              Preserved
            </span>
          </div>
          <p className="mt-1 text-xs font-medium text-purple-700/80 dark:text-purple-300/80">
            Zero slot consumption · Free restore
          </p>
        </div>

        {/* 4. Active Plan Tier */}
        <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/[0.12] via-orange-500/[0.04] to-card p-5 shadow-xs transition-all hover:border-amber-500/50 hover:shadow-md hover:shadow-amber-500/5 dark:from-amber-950/60 dark:via-orange-950/30 dark:to-card/90">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wider text-amber-700 uppercase dark:text-amber-300">
              Subscription Tier
            </span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 ring-1 ring-amber-500/30 dark:bg-amber-500/25 dark:text-amber-400">
              <Sparkles className="size-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black tracking-tight text-amber-950 sm:text-3xl dark:text-amber-100">
              {cap.planName}
            </span>
          </div>
          <p className="mt-1 text-xs font-medium text-amber-700/80 dark:text-amber-300/80">
            Unlimited return generations
          </p>
        </div>
      </div>

      {/* ── Capacity Warning Alert ── */}
      {atCapacity && showForm && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs font-medium text-amber-800 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="font-bold">GSTIN Capacity Limit Reached</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              You are currently using all {cap.used}/{cap.totalCapacity} slots. To add another
              GSTIN, archive an existing active registration to free a slot, or expand your capacity
              on the Billing page.
            </p>
          </div>
        </div>
      )}

      {/* ── Add GSTIN Form Panel ── */}
      {showForm && (
        <form
          onSubmit={handleAdd}
          className="space-y-4 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card p-6 shadow-sm"
        >
          <div className="flex items-center justify-between border-b border-border/80 pb-3">
            <div>
              <h3 className="text-base font-bold text-foreground">Add New GSTIN Profile</h3>
              <p className="text-xs text-muted-foreground">
                Enter your client or business GST registration details for GSTR-1 returns.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                GSTIN Number *
              </label>
              <input
                type="text"
                required
                maxLength={15}
                value={form.gstinNumber}
                onChange={(e) => setForm({ ...form, gstinNumber: e.target.value.toUpperCase() })}
                placeholder="27AABCS1234A1Z5"
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 font-mono text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                Legal Entity Name *
              </label>
              <input
                type="text"
                required
                value={form.legalName}
                onChange={(e) => setForm({ ...form, legalName: e.target.value })}
                placeholder="As per GST registration certificate"
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                Trade Name (Optional)
              </label>
              <input
                type="text"
                value={form.tradeName}
                onChange={(e) => setForm({ ...form, tradeName: e.target.value })}
                placeholder="e.g. Acme Online Store"
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="gstin-business-type"
                className="text-xs font-bold tracking-wide text-muted-foreground uppercase"
              >
                Nature of Business
              </label>
              <select
                id="gstin-business-type"
                value={form.businessType}
                onChange={(e) => setForm({ ...form, businessType: e.target.value })}
                className="w-full cursor-pointer rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none"
              >
                {BUSINESS_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center pt-2 md:col-span-2">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                  className="size-4 rounded border-border text-primary focus:ring-primary"
                />
                <span>Set as primary default GSTIN for conversions</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 border-t border-border/80 pt-4">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-xl border border-border px-4 py-2 text-xs font-bold transition hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/25 transition hover:brightness-110 disabled:opacity-50"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Save Profile
            </button>
          </div>
        </form>
      )}

      {/* ── Table Controls Bar: Tabs, Search & Add Button ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Active vs Archived Tabs */}
        <div className="inline-flex rounded-xl border border-border bg-muted/30 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("active")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all",
              activeTab === "active"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Building2 className="size-3.5" />
            <span>Active Registrations ({active.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("archived")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all",
              activeTab === "archived"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Archive className="size-3.5" />
            <span>Archived ({archived.length})</span>
          </button>
        </div>

        {/* Search & Add Action */}
        <div className="flex items-center gap-2.5">
          <div className="relative w-full sm:w-72">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search GSTIN, legal name, state…"
              aria-label="Search GST profiles"
              prefixNode={<Search className="size-3.5 text-muted-foreground" />}
              suffixNode={
                query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                    className="rounded p-0.5 hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : undefined
              }
              className="h-9 text-xs"
            />
          </div>

          <Button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            size="sm"
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 px-3.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:brightness-110"
          >
            <Plus className="size-3.5" />
            <span>Add GSTIN</span>
          </Button>
        </div>
      </div>

      {/* ── ACTIVE PROFILES TABLE ── */}
      {activeTab === "active" && (
        <>
          {active.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center">
              <Building2 className="mx-auto mb-3 size-10 text-muted-foreground" />
              <p className="text-sm font-bold text-foreground">No active GSTIN profiles</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add your business or client GSTIN to start generating verified GSTR-1 returns.
              </p>
              <Button size="sm" className="mt-4" onClick={() => setShowForm(true)}>
                <Plus className="mr-1.5 size-3.5" /> Add First GSTIN
              </Button>
            </div>
          ) : visibleActive.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No matching GST profiles"
              description={`No profiles match “${query}”. Try searching by 15-digit GSTIN, legal name, or state.`}
              action={
                <Button variant="outline" size="sm" onClick={() => setQuery("")}>
                  Clear search
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-blue-500/25 bg-card shadow-sm">
              <table className="w-full min-w-[880px] text-left text-[14px]">
                {/* Dark Attractive Table Header */}
                <thead className="border-b border-blue-500/30 bg-gradient-to-r from-[#0B132B] via-[#111C3A] to-[#1C2541] text-xs font-bold tracking-wider text-blue-100 uppercase shadow-xs dark:from-[#080E1E] dark:via-[#0F1932] dark:to-[#0A1224]">
                  <tr>
                    <th className="w-14 px-4.5 py-3.5 text-center">Default</th>
                    <th className="px-4.5 py-3.5">GSTIN Number</th>
                    <th className="px-4.5 py-3.5">Business / Legal Name</th>
                    <th className="px-4.5 py-3.5">Nature of Business</th>
                    <th className="px-4.5 py-3.5">State &amp; Jurisdiction</th>
                    <th className="px-4.5 py-3.5">Filing Status</th>
                    <th className="px-4.5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {visibleActive.map((profile, i) => {
                    const isAlternate = i % 2 === 1;
                    const meta = businessTypeMeta(
                      (profile as { businessType?: string }).businessType || ""
                    );
                    const NatureIcon = meta.icon;

                    return (
                      <tr
                        key={profile.id}
                        className={cn(
                          "transition-colors hover:bg-blue-500/[0.06] dark:hover:bg-blue-400/[0.08]",
                          isAlternate ? "bg-slate-500/[0.035] dark:bg-slate-400/[0.04]" : "bg-card",
                          profile.isDefault && "border-l-4 border-l-blue-600"
                        )}
                      >
                        {/* 1. Default Star Column */}
                        <td className="px-4.5 py-3.5 text-center">
                          {profile.isDefault ? (
                            <span
                              className="inline-flex size-7 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/15 text-amber-500 shadow-2xs"
                              title="Primary default GSTIN profile"
                            >
                              <Star className="size-3.5 fill-amber-500" />
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSetDefault(profile.id)}
                              className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground/60 transition hover:bg-amber-500/15 hover:text-amber-500"
                              title="Click to set as primary default"
                            >
                              <Star className="size-3.5" />
                            </button>
                          )}
                        </td>

                        {/* 2. GSTIN Number */}
                        <td className="px-4.5 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[14px] font-bold text-foreground">
                              {profile.gstinNumber}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyGstin(profile.gstinNumber, profile.id)}
                              className="rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                              title="Copy GSTIN"
                            >
                              {copiedId === profile.id ? (
                                <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <Copy className="size-3.5" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* 3. Business / Legal Name */}
                        <td className="max-w-[280px] px-4.5 py-3.5">
                          <p
                            className="truncate text-[14px] font-semibold text-foreground"
                            title={profile.legalName}
                          >
                            {profile.legalName}
                          </p>
                          {profile.tradeName ? (
                            <p
                              className="truncate text-xs font-medium text-muted-foreground"
                              title={profile.tradeName}
                            >
                              Trade: {profile.tradeName}
                            </p>
                          ) : (
                            <p className="text-2xs text-muted-foreground">Trade name: —</p>
                          )}
                        </td>

                        {/* 4. Nature of Business */}
                        <td className="px-4.5 py-3.5">
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300">
                            <NatureIcon className="size-3.5 shrink-0" />
                            <span className="truncate">{meta.label}</span>
                          </span>
                        </td>

                        {/* 5. State & Jurisdiction */}
                        <td className="px-4.5 py-3.5">
                          <div className="flex items-center gap-1.5 text-[13.5px] font-medium text-foreground">
                            <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
                            <span>{profile.stateName}</span>
                            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-2xs text-muted-foreground">
                              ({profile.stateCode})
                            </span>
                          </div>
                        </td>

                        {/* 6. Status */}
                        <td className="px-4.5 py-3.5">
                          {profile.isDefault ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                              <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                              Primary Default
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400">
                              <span className="size-1.5 rounded-full bg-blue-500" />
                              Active
                            </span>
                          )}
                        </td>

                        {/* 7. Actions */}
                        <td className="px-4.5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {!profile.isDefault && (
                              <button
                                type="button"
                                onClick={() => handleSetDefault(profile.id)}
                                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400"
                                title="Set as primary default"
                              >
                                <Star className="size-3.5" />
                                <span>Make Default</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setArchiveTarget(profile)}
                              disabled={busyId === profile.id}
                              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
                              title="Archive this profile to free a slot"
                            >
                              {busyId === profile.id ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Archive className="size-3.5" />
                              )}
                              <span>Archive</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── ARCHIVED PROFILES TABLE ── */}
      {activeTab === "archived" && (
        <>
          {archived.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center">
              <Archive className="mx-auto mb-3 size-10 text-muted-foreground" />
              <p className="text-sm font-bold text-foreground">No archived profiles</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Profiles you archive to free capacity slots will appear here with full data
                preserved.
              </p>
            </div>
          ) : visibleArchived.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No matching archived profiles"
              description={`No archived profiles match “${query}”.`}
              action={
                <Button variant="outline" size="sm" onClick={() => setQuery("")}>
                  Clear search
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-blue-500/25 bg-card shadow-sm">
              <table className="w-full min-w-[840px] text-left text-[14px]">
                {/* Dark Attractive Table Header */}
                <thead className="border-b border-blue-500/30 bg-gradient-to-r from-[#0B132B] via-[#111C3A] to-[#1C2541] text-xs font-bold tracking-wider text-blue-100 uppercase shadow-xs dark:from-[#080E1E] dark:via-[#0F1932] dark:to-[#0A1224]">
                  <tr>
                    <th className="px-4.5 py-3.5">GSTIN Number</th>
                    <th className="px-4.5 py-3.5">Legal Entity Name</th>
                    <th className="px-4.5 py-3.5">State &amp; Jurisdiction</th>
                    <th className="px-4.5 py-3.5">Status</th>
                    <th className="px-4.5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {visibleArchived.map((profile, i) => {
                    const isAlternate = i % 2 === 1;

                    return (
                      <tr
                        key={profile.id}
                        className={cn(
                          "transition-colors hover:bg-blue-500/[0.06] dark:hover:bg-blue-400/[0.08]",
                          isAlternate ? "bg-slate-500/[0.035] dark:bg-slate-400/[0.04]" : "bg-card"
                        )}
                      >
                        {/* 1. GSTIN Number */}
                        <td className="px-4.5 py-3.5">
                          <span className="font-mono text-[14px] font-bold text-muted-foreground">
                            {profile.gstinNumber}
                          </span>
                        </td>

                        {/* 2. Legal Entity Name */}
                        <td className="px-4.5 py-3.5">
                          <p className="font-semibold text-muted-foreground">{profile.legalName}</p>
                          {profile.tradeName && (
                            <p className="text-xs text-muted-foreground/80">{profile.tradeName}</p>
                          )}
                        </td>

                        {/* 3. State & Jurisdiction */}
                        <td className="px-4.5 py-3.5">
                          <div className="flex items-center gap-1.5 text-[13.5px] text-muted-foreground">
                            <MapPin className="size-3.5 shrink-0" />
                            <span>{profile.stateName}</span>
                            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-2xs">
                              ({profile.stateCode})
                            </span>
                          </div>
                        </td>

                        {/* 4. Status */}
                        <td className="px-4.5 py-3.5">
                          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                            Archived (Preserved)
                          </span>
                        </td>

                        {/* 5. Actions */}
                        <td className="px-4.5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busyId === profile.id || atCapacity}
                              title={
                                atCapacity
                                  ? "No free slot — archive an active profile or add capacity first"
                                  : "Restore this profile to active"
                              }
                              onClick={() => handleRestore(profile)}
                              className="text-xs font-semibold"
                            >
                              {busyId === profile.id ? (
                                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                              ) : (
                                <RotateCcw className="mr-1.5 size-3.5" />
                              )}
                              Restore
                            </Button>
                            <button
                              type="button"
                              onClick={() => openDeleteDialog(profile)}
                              disabled={busyId === profile.id}
                              className="rounded-lg p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                              title="Delete permanently"
                              aria-label={`Delete ${profile.legalName} permanently`}
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Archive Confirmation Modal ── */}
      <Modal
        open={archiveTarget !== null}
        onClose={() => {
          if (!busyId) setArchiveTarget(null);
        }}
        size="md"
        icon={<Archive className="size-4 text-primary-ink" />}
        title="Archive this GSTIN?"
        footer={
          <div className="flex w-full items-center justify-between gap-2">
            <span className="text-2xs text-muted-foreground">Reversible · nothing is deleted</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={busyId !== null}
                onClick={() => setArchiveTarget(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={busyId !== null}
                onClick={confirmArchive}
              >
                {busyId ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Archive className="size-4" />
                )}
                Archive
              </Button>
            </div>
          </div>
        }
      >
        {archiveTarget && (
          <div className="space-y-4 px-5 py-4">
            <ProfileIdentityCard profile={archiveTarget} />

            <div className="rounded-xl border border-success/25 bg-success/5 p-3.5">
              <p className="text-2xs font-bold tracking-wider text-success-ink uppercase">
                Capacity after archiving
              </p>
              <div className="mt-2 flex items-center gap-3">
                <SlotFigure label="Active" from={cap.used} to={cap.used - 1} />
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <SlotFigure
                  label="Free slots"
                  from={cap.available}
                  to={cap.available + 1}
                  highlight
                />
              </div>
            </div>

            <ul className="space-y-2 text-xs">
              <OutcomeRow tone="success" icon={Check}>
                The slot frees up <strong className="font-semibold text-foreground">now</strong> —
                use it for another GSTIN, or restore this one later.
              </OutcomeRow>
              <OutcomeRow tone="success" icon={ShieldCheck}>
                Conversion history, reports and settings stay{" "}
                <strong className="font-semibold text-foreground">fully preserved</strong>.
              </OutcomeRow>
              <OutcomeRow tone="neutral" icon={RotateCcw}>
                Restoring costs <strong className="font-semibold text-foreground">nothing</strong>{" "}
                as long as a slot is free.
              </OutcomeRow>
              {archiveTarget.isDefault && (
                <OutcomeRow tone="warning" icon={Star}>
                  This is your{" "}
                  <strong className="font-semibold text-foreground">default GSTIN</strong> — you
                  will need to pick a new default.
                </OutcomeRow>
              )}
            </ul>
          </div>
        )}
      </Modal>

      {/* ── Permanent Delete Confirmation Modal ── */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => {
          if (!busyId) setDeleteTarget(null);
        }}
        size="md"
        icon={<AlertTriangle className="size-4 text-destructive" />}
        title="Delete permanently?"
        footer={
          <div className="flex w-full items-center justify-between gap-2">
            <span className="text-2xs font-medium text-destructive-ink">Cannot be undone</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={busyId !== null}
                onClick={() => setDeleteTarget(null)}
              >
                Keep archived
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={busyId !== null || !deleteTarget?.impact}
                onClick={confirmDelete}
              >
                {busyId ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                Delete permanently
              </Button>
            </div>
          </div>
        }
      >
        {!deleteTarget?.impact ? (
          <div className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Checking historical records…
          </div>
        ) : (
          <div className="space-y-4 px-5 py-4">
            <ProfileIdentityCard profile={deleteTarget.profile} muted />

            <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 p-3.5">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
              <p className="text-xs text-muted-foreground">
                This removes the profile and its saved details for good. There is no undo — you
                would have to re-enter the GSTIN from scratch.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-subtle p-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <FileText className="size-3.5" aria-hidden />
                  Filing records kept for {deleteTarget.impact.gstinNumber}
                </span>
                <span className="text-lg font-bold text-foreground tabular-nums">
                  {deleteTarget.impact.reportCount}
                </span>
              </div>
              <p className="mt-1.5 text-2xs text-muted-foreground">
                Conversion and GSTR-1 history is stored against the GSTIN, so it survives this
                deletion.
              </p>
            </div>

            <p className="text-2xs text-muted-foreground">
              This frees no capacity — the profile is already archived and not using a slot.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
