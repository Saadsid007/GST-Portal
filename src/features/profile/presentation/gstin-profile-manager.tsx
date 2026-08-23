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
} from "lucide-react";
import { filterGstinProfiles } from "@/features/profile/domain/gstin-search";
import { Button, EmptyState, Input, Modal } from "@/components/ui";
import type { GstinProfile } from "@/generated/prisma/client";
import type { GstinDeletionImpact } from "@/features/billing/services/capacity.service";
import { BUSINESS_TYPE_OPTIONS, businessTypeMeta } from "@/features/profile/domain/business-type";
import {
  addGstinProfileAction,
  deleteGstinProfileAction,
  getGstinDeletionImpactAction,
  setDefaultGstinAction,
} from "@/features/profile/actions/profile.actions";

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

interface Props {
  initialProfiles: GstinProfile[];
}

export function GstinProfileManager({ initialProfiles }: Props) {
  const [profiles, setProfiles] = useState(initialProfiles);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  // Deleting is quota-relevant, so the dialog waits on the server's verdict
  // rather than guessing whether the slot comes back.
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    impact: GstinDeletionImpact | null;
  } | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    gstinNumber: "",
    legalName: "",
    tradeName: "",
    businessType: "ECOMMERCE_SELLER",
    isDefault: false,
  });

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await addGstinProfileAction(form);
      if (res.success && res.data) {
        setProfiles((prev) => {
          const updated = form.isDefault ? prev.map((p) => ({ ...p, isDefault: false })) : prev;
          return [res.data!, ...updated];
        });
        setForm({
          gstinNumber: "",
          legalName: "",
          tradeName: "",
          businessType: "ECOMMERCE_SELLER",
          isDefault: false,
        });
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

  async function openDeleteDialog(id: string) {
    setPendingDelete({ id, impact: null });
    setImpactLoading(true);
    try {
      const res = await getGstinDeletionImpactAction(id);
      if (res.success && res.data) {
        setPendingDelete({ id, impact: res.data });
      } else {
        setPendingDelete(null);
        toast.error(res.error || "Could not load profile");
      }
    } catch {
      setPendingDelete(null);
      toast.error("Something went wrong");
    } finally {
      setImpactLoading(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const { id } = pendingDelete;
    setDeleting(true);
    try {
      const res = await deleteGstinProfileAction(id);
      if (!res.success) {
        toast.error(res.error || "Failed to delete profile");
        return;
      }
      setProfiles((prev) => prev.filter((p) => p.id !== id));
      setPendingDelete(null);
      toast.success(
        res.slotRetained && res.releasesOn
          ? `Profile deleted. The GSTIN slot stays reserved until ${dateFmt.format(new Date(res.releasesOn))}.`
          : "Profile deleted"
      );
    } catch {
      toast.error("Something went wrong");
    } finally {
      setDeleting(false);
    }
  }

  async function handleSetDefault(id: string) {
    await setDefaultGstinAction(id);
    setProfiles((prev) => prev.map((p) => ({ ...p, isDefault: p.id === id })));
    toast.success("Default GSTIN updated");
  }

  // Search appears only once the list stops being scannable at a glance.
  // From two profiles up. At one, a search field is noise.
  const showSearch = profiles.length >= 2;
  const visible = useMemo(() => filterGstinProfiles(profiles, query), [profiles, query]);

  return (
    <div className="space-y-4">
      {/* Add Button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
        >
          <Plus className="size-4" />
          Add GSTIN
        </button>
      </div>

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
            Showing {visible.length} of {profiles.length} profiles
          </p>
        </div>
      )}

      {/* Profiles List */}
      {profiles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <Building2 className="mx-auto mb-3 size-10 text-muted-foreground" />
          <p className="text-sm font-medium">No GSTIN profiles yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add your first GSTIN to start generating GSTR-1
          </p>
        </div>
      ) : visible.length === 0 ? (
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
          {visible.map((profile) => (
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
                      businessTypeMeta(
                        (profile as unknown as { businessType?: string }).businessType || ""
                      ).label
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
                  onClick={() => openDeleteDialog(profile.id)}
                  title="Delete profile"
                  aria-label={`Delete ${profile.legalName}`}
                  className="rounded-lg p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={pendingDelete !== null}
        onClose={() => {
          if (!deleting) setPendingDelete(null);
        }}
        size="md"
        icon={<AlertTriangle className="size-5 text-destructive" />}
        title="Delete this GSTIN profile?"
        description={
          pendingDelete?.impact
            ? `${pendingDelete.impact.legalName} · ${pendingDelete.impact.gstinNumber}`
            : undefined
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={deleting}
              onClick={() => setPendingDelete(null)}
            >
              Keep profile
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleting || impactLoading}
              onClick={confirmDelete}
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Delete anyway
            </Button>
          </div>
        }
      >
        {impactLoading || !pendingDelete?.impact ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Checking your plan usage…
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Deleting removes the profile and its saved details from your workspace. Conversion
              history stays intact.
            </p>

            {pendingDelete.impact.slotRetained ? (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="space-y-1">
                  <p className="font-bold text-foreground">
                    This will not free up a GSTIN slot right now
                  </p>
                  <p className="text-muted-foreground">
                    This GSTIN was added during your current billing period, so it stays counted
                    against your {pendingDelete.impact.planName} quota until{" "}
                    <span className="font-semibold text-foreground">
                      {dateFmt.format(new Date(pendingDelete.impact.releasesOn))}
                    </span>
                    . You will still have{" "}
                    <span className="font-semibold text-foreground">
                      {pendingDelete.impact.availableAfterDelete} of{" "}
                      {pendingDelete.impact.totalCapacity}
                    </span>{" "}
                    slots available after deleting.
                  </p>
                  <p className="text-muted-foreground">
                    Re-adding this same GSTIN later in this period is free — it will not consume
                    another slot.
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-muted/40 p-3.5 text-xs text-muted-foreground">
                This GSTIN was not added during your current billing period, so deleting it frees a
                slot immediately —{" "}
                <span className="font-semibold text-foreground">
                  {pendingDelete.impact.availableAfterDelete} of{" "}
                  {pendingDelete.impact.totalCapacity}
                </span>{" "}
                slots will be available.
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
