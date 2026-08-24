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
        icon={<Archive className="size-5 text-foreground" />}
        title="Archive this GSTIN profile?"
        description={
          archiveTarget ? `${archiveTarget.legalName} · ${archiveTarget.gstinNumber}` : undefined
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={busyId !== null}
              onClick={() => setArchiveTarget(null)}
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" disabled={busyId !== null} onClick={confirmArchive}>
              {busyId ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Archive className="size-4" />
              )}
              Archive
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            Archiving frees this GSTIN&rsquo;s capacity slot immediately. All conversion history,
            reports and settings are preserved.
          </p>
          <p>
            You can restore it into any free slot later at no extra cost, or add a different GSTIN
            in its place.
          </p>
        </div>
      </Modal>

      {/* Permanent delete confirmation */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => {
          if (!busyId) setDeleteTarget(null);
        }}
        size="md"
        icon={<AlertTriangle className="size-5 text-destructive" />}
        title="Delete this GSTIN permanently?"
        description={
          deleteTarget
            ? `${deleteTarget.profile.legalName} · ${deleteTarget.profile.gstinNumber}`
            : undefined
        }
        footer={
          <div className="flex justify-end gap-2">
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
              {busyId ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Delete permanently
            </Button>
          </div>
        }
      >
        {!deleteTarget?.impact ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Checking historical records…
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              This removes the profile permanently. Its filing history is kept for your records and
              is not deleted.
            </p>
            <div className="rounded-xl border border-border bg-muted/40 p-3.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">GSTR-1 / conversion records preserved</span>
                <span className="font-bold text-foreground">{deleteTarget.impact.reportCount}</span>
              </div>
            </div>
            <p className="text-2xs text-muted-foreground">
              This does not free a capacity slot — the profile is already archived.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
