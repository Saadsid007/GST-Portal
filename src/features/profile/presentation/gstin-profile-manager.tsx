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
  CheckCircle,
  Search,
  X,
  AlertTriangle,
  Archive,
  RotateCcw,
  ArrowRight,
  Check,
  ShieldCheck,
  FileText,
} from "lucide-react";
import { filterGstinProfiles } from "@/features/profile/domain/gstin-search";
import { Button, EmptyState, Input, Modal } from "@/components/ui";
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

/**
 * The profile being acted on, restated inside the dialog. A confirmation that
 * only names the business in a subtitle is too easy to misread when several
 * clients share a similar name — the GSTIN is the unambiguous identifier.
 */
function ProfileIdentityCard({ profile, muted }: { profile: GstinProfile; muted?: boolean }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border border-border p-3.5 ${muted ? "bg-muted/40" : "bg-subtle"}`}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background">
        <Building2 className="size-4 text-muted-foreground" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{profile.legalName}</p>
        <p className="mt-0.5 font-mono text-xs tracking-tight text-muted-foreground">
          {profile.gstinNumber}
        </p>
        <p className="mt-1 flex items-center gap-1 text-2xs text-muted-foreground">
          <MapPin className="size-3" aria-hidden />
          {profile.stateName} ({profile.stateCode})
        </p>
      </div>
    </div>
  );
}

/** A single capacity figure shown as before → after, so the change is legible. */
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
      <p className="text-2xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 flex items-baseline gap-1.5 tabular-nums">
        <span className="text-xs text-muted-foreground line-through">{from}</span>
        <span className={`text-lg font-bold ${highlight ? "text-success-ink" : "text-foreground"}`}>
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
      <Icon className={`mt-0.5 size-3.5 shrink-0 ${OUTCOME_TONES[tone]}`} aria-hidden />
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
  const [form, setForm] = useState(EMPTY_FORM);

  // Confirmation flows are capacity-relevant, so both wait on the server.
  const [archiveTarget, setArchiveTarget] = useState<GstinProfile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    profile: GstinProfile;
    impact: PermanentDeleteImpact | null;
  } | null>(null);

  const atCapacity = cap.available <= 0;

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
        toast.success("GSTIN profile added");
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
      toast.success("Profile archived — slot freed. Data is preserved.");
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
    toast.success("Default GSTIN updated");
  }

  const showSearch = active.length >= 2;
  const visibleActive = useMemo(() => filterGstinProfiles(active, query), [active, query]);

  return (
    <div className="space-y-5">
      {/* Capacity summary */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-sm">
          <span>
            <span className="font-bold text-foreground">{cap.used}</span>
            <span className="text-muted-foreground"> / {cap.totalCapacity} active</span>
          </span>
          <span className="text-muted-foreground">
            {cap.available} slot{cap.available === 1 ? "" : "s"} available
          </span>
          {cap.archivedProfiles > 0 && (
            <span className="text-muted-foreground">{cap.archivedProfiles} archived</span>
          )}
          <span className="text-2xs text-muted-foreground">{cap.planName}</span>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
        >
          <Plus className="size-4" />
          Add GSTIN
        </button>
      </div>

      {atCapacity && showForm && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-muted-foreground">
            You&rsquo;re at capacity ({cap.used}/{cap.totalCapacity}). Archive an active GSTIN to
            free a slot, restore one you already have, or add capacity on the billing page.
          </p>
        </div>
      )}

      {/* Add Form */}
      {showForm && (
        <form
          onSubmit={handleAdd}
          className="space-y-4 rounded-xl border border-primary/30 bg-primary/5 p-6"
        >
          <h3 className="text-sm font-semibold">Add New GSTIN Profile</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                GSTIN Number *
              </label>
              <input
                type="text"
                required
                maxLength={15}
                value={form.gstinNumber}
                onChange={(e) => setForm({ ...form, gstinNumber: e.target.value.toUpperCase() })}
                placeholder="27AABCS1234A1Z5"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Legal Name *
              </label>
              <input
                type="text"
                required
                value={form.legalName}
                onChange={(e) => setForm({ ...form, legalName: e.target.value })}
                placeholder="As per GST registration"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Trade Name
              </label>
              <input
                type="text"
                value={form.tradeName}
                onChange={(e) => setForm({ ...form, tradeName: e.target.value })}
                placeholder="Optional"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="gstin-business-type"
                className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
              >
                Nature of Business
              </label>
              <select
                id="gstin-business-type"
                value={form.businessType}
                onChange={(e) => setForm({ ...form, businessType: e.target.value })}
                className="w-full cursor-pointer rounded-lg border border-border bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none"
              >
                {BUSINESS_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="text-2xs text-muted-foreground">
                {BUSINESS_TYPE_OPTIONS.find((o) => o.value === form.businessType)?.hint}
              </p>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Set as default GSTIN</span>
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm transition hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Add Profile
            </button>
          </div>
        </form>
      )}

      {showSearch && (
        <div className="space-y-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by GSTIN, business name or state…"
            aria-label="Search GST profiles"
            prefixNode={<Search />}
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
          />
          <p className="text-2xs text-muted-foreground">
            Showing {visibleActive.length} of {active.length} active profiles
          </p>
        </div>
      )}

      {/* Active profiles */}
      {active.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <Building2 className="mx-auto mb-3 size-10 text-muted-foreground" />
          <p className="text-sm font-medium">No active GSTIN profiles</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add your first GSTIN to start generating GSTR-1
          </p>
        </div>
      ) : visibleActive.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching GST profile"
          description={`Nothing matches “${query}”. Try the GSTIN, the business name, or the state.`}
          action={
            <Button variant="outline" size="sm" onClick={() => setQuery("")}>
              Clear search
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {visibleActive.map((profile) => (
            <div
              key={profile.id}
              className={`flex flex-col gap-3 rounded-xl border p-5 transition sm:flex-row sm:items-start sm:justify-between ${profile.isDefault ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}
            >
              <div className="flex min-w-0 items-start gap-3">
                <div
                  className={`flex size-9 flex-shrink-0 items-center justify-center rounded-lg ${profile.isDefault ? "bg-primary/20" : "bg-muted"}`}
                >
                  <Building2
                    className={`size-4 ${profile.isDefault ? "text-primary-ink" : "text-muted-foreground"}`}
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">{profile.legalName}</p>
                    {profile.isDefault && (
                      <span className="flex flex-shrink-0 items-center gap-1 rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary-ink">
                        <CheckCircle className="size-2.5" /> Default
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {profile.gstinNumber}
                  </p>
                  {profile.tradeName && (
                    <p className="text-xs text-muted-foreground">{profile.tradeName}</p>
                  )}
                  <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-2xs font-medium text-muted-foreground">
                    {
                      businessTypeMeta((profile as { businessType?: string }).businessType || "")
                        .label
                    }
                  </p>
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3" />
                    <span>
                      {profile.stateName} ({profile.stateCode})
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                {!profile.isDefault && (
                  <button
                    onClick={() => handleSetDefault(profile.id)}
                    title="Set as default"
                    className="rounded-lg p-2 text-muted-foreground transition hover:bg-warning/10 hover:text-warning"
                  >
                    <Star className="size-4" />
                  </button>
                )}
                <button
                  onClick={() => setArchiveTarget(profile)}
                  title="Archive profile"
                  aria-label={`Archive ${profile.legalName}`}
                  disabled={busyId === profile.id}
                  className="rounded-lg p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-50"
                >
                  {busyId === profile.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Archive className="size-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Archived profiles */}
      {archived.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <Archive className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-muted-foreground">
              Archived ({archived.length})
            </h2>
          </div>
          <p className="text-2xs text-muted-foreground">
            Archived profiles keep all data and don&rsquo;t use capacity. Restore into a free slot
            at no cost, or delete permanently.
          </p>
          {archived.map((profile) => (
            <div
              key={profile.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-5 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Building2 className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-muted-foreground">
                    {profile.legalName}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {profile.gstinNumber}
                  </p>
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3" />
                    <span>
                      {profile.stateName} ({profile.stateCode})
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busyId === profile.id || atCapacity}
                  title={atCapacity ? "No free slot — archive or add capacity first" : "Restore"}
                  onClick={() => handleRestore(profile)}
                >
                  {busyId === profile.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RotateCcw className="size-4" />
                  )}
                  Restore
                </Button>
                <button
                  onClick={() => openDeleteDialog(profile)}
                  title="Delete permanently"
                  aria-label={`Delete ${profile.legalName} permanently`}
                  disabled={busyId === profile.id}
                  className="rounded-lg p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Archive confirmation */}
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

            {/* The number the user is really deciding about. */}
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

      {/* Permanent delete confirmation */}
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

            {/* What survives, stated as a number rather than a promise. */}
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
