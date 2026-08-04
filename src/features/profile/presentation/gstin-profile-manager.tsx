"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Star, Building2, MapPin, Loader2, CheckCircle } from "lucide-react";
import type { GstinProfile } from "@/generated/prisma/client";
import {
  addGstinProfileAction,
  deleteGstinProfileAction,
  setDefaultGstinAction,
} from "@/features/profile/actions/profile.actions";

interface Props {
  initialProfiles: GstinProfile[];
}

export function GstinProfileManager({ initialProfiles }: Props) {
  const [profiles, setProfiles] = useState(initialProfiles);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    gstinNumber: "",
    legalName: "",
    tradeName: "",
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
        setForm({ gstinNumber: "", legalName: "", tradeName: "", isDefault: false });
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

  async function handleDelete(id: string) {
    if (!confirm("Delete this GSTIN profile?")) return;
    await deleteGstinProfileAction(id);
    setProfiles((prev) => prev.filter((p) => p.id !== id));
    toast.success("Profile deleted");
  }

  async function handleSetDefault(id: string) {
    await setDefaultGstinAction(id);
    setProfiles((prev) => prev.map((p) => ({ ...p, isDefault: p.id === id })));
    toast.success("Default GSTIN updated");
  }

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

      {/* Profiles List */}
      {profiles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <Building2 className="mx-auto mb-3 size-10 text-muted-foreground" />
          <p className="text-sm font-medium">No GSTIN profiles yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add your first GSTIN to start generating GSTR-1
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className={`flex items-start justify-between gap-4 rounded-xl border p-5 transition ${profile.isDefault ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}
            >
              <div className="flex min-w-0 items-start gap-3">
                <div
                  className={`flex size-9 flex-shrink-0 items-center justify-center rounded-lg ${profile.isDefault ? "bg-primary/20" : "bg-muted"}`}
                >
                  <Building2
                    className={`size-4 ${profile.isDefault ? "text-primary" : "text-muted-foreground"}`}
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">{profile.legalName}</p>
                    {profile.isDefault && (
                      <span className="flex flex-shrink-0 items-center gap-1 rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary">
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
                    className="rounded-lg p-2 text-muted-foreground transition hover:bg-amber-500/10 hover:text-amber-500"
                  >
                    <Star className="size-4" />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(profile.id)}
                  className="rounded-lg p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
