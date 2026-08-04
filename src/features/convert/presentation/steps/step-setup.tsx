"use client";

import type { GstinProfile } from "@/generated/prisma";
import type { PlatformInfo } from "@/features/convert/types/convert.types";
import type { MultiConvertState } from "@/features/convert/presentation/convert-workbench";
import { PLATFORMS_CONFIG } from "@/features/convert/config/platform.config";
import { cn } from "@/lib/utils";
import {
  Building2,
  Calendar,
  Check,
  ArrowRight,
  Store,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Package,
  Zap,
  FileSpreadsheet,
} from "lucide-react";

interface Props {
  state: MultiConvertState;
  profiles: GstinProfile[];
  platforms: PlatformInfo[];
  onChange: (updates: Partial<MultiConvertState>) => void;
  onNext: () => void;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  ShoppingBag,
  Store,
  ShoppingCart,
  Sparkles,
  Package,
  Zap,
  FileSpreadsheet,
};

export function StepSetup({ state, profiles, onChange, onNext }: Props) {
  const selectedProfile = profiles.find((p) => p.gstinNumber === state.gstinNumber) ?? profiles[0];

  function togglePlatform(id: string) {
    const current = state.selectedPlatformIds;
    if (current.includes(id)) {
      if (current.length === 1) return; // Must keep at least one selected
      onChange({ selectedPlatformIds: current.filter((p) => p !== id) });
    } else {
      onChange({ selectedPlatformIds: [...current, id] });
    }
  }

  function selectAllPlatforms() {
    onChange({ selectedPlatformIds: PLATFORMS_CONFIG.map((p) => p.id) });
  }

  // Format return period YYYYMM -> YYYY-MM for month input
  const monthInputValue =
    state.returnPeriod.length === 6
      ? `${state.returnPeriod.slice(2, 6)}-${state.returnPeriod.slice(0, 2)}`
      : new Date().toISOString().slice(0, 7);

  function handleMonthChange(val: string) {
    // val is "YYYY-MM" -> convert to "MMYYYY"
    const [year, month] = val.split("-");
    if (year && month) {
      onChange({ returnPeriod: `${month}${year}` });
    }
  }

  return (
    <div className="space-y-8 p-6 md:p-8">
      <div>
        <h2 className="text-xl font-bold">Select Return Period & Marketplaces</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose your GSTIN, return filing month, and select all marketplaces you want to include in
          this combined GSTR-1 return.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* GSTIN Selector */}
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <Building2 className="size-3.5" /> Select GST Profile
          </label>
          <select
            value={state.gstinNumber}
            onChange={(e) => onChange({ gstinNumber: e.target.value })}
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-primary/50 focus:outline-none"
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.gstinNumber}>
                {p.legalName} ({p.gstinNumber}) — {p.stateName}
              </option>
            ))}
          </select>
          {selectedProfile && (
            <div className="rounded-lg bg-muted/30 px-3 py-2 font-mono text-xs text-muted-foreground">
              State: {selectedProfile.stateName} ({selectedProfile.stateCode})
            </div>
          )}
        </div>

        {/* Return Period Picker */}
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <Calendar className="size-3.5" /> Return Filing Month
          </label>
          <input
            type="month"
            value={monthInputValue}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-primary/50 focus:outline-none"
          />
          <div className="rounded-lg bg-muted/30 px-3 py-2 font-mono text-xs text-muted-foreground">
            Return Period Code:{" "}
            <span className="font-bold text-foreground">{state.returnPeriod || "MMYYYY"}</span>
          </div>
        </div>
      </div>

      {/* Multi-Marketplace Selector */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold">
              Select Marketplaces ({state.selectedPlatformIds.length} selected)
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Select all platforms you sold on during this month. All reports will be combined into
              1 GSTR-1 file.
            </p>
          </div>
          <button
            type="button"
            onClick={selectAllPlatforms}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Select All
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PLATFORMS_CONFIG.map((plat) => {
            const isSelected = state.selectedPlatformIds.includes(plat.id);
            const IconComponent = ICON_MAP[plat.iconName] ?? Store;

            return (
              <button
                type="button"
                key={plat.id}
                onClick={() => togglePlatform(plat.id)}
                className={cn(
                  "group relative flex items-start gap-3 overflow-hidden rounded-xl border p-4 text-left transition-all",
                  isSelected
                    ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/30"
                    : "border-border bg-background hover:border-primary/40 hover:bg-accent/40"
                )}
              >
                <div
                  className={cn(
                    "flex size-9 flex-shrink-0 items-center justify-center rounded-lg transition-all",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                  )}
                >
                  <IconComponent className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold">{plat.name}</p>
                    {isSelected && (
                      <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                        <Check className="size-2.5" />
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                    {plat.description}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {plat.files.length} report type{plat.files.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Next Action */}
      <div className="flex justify-end border-t border-border pt-4">
        <button
          type="button"
          onClick={onNext}
          disabled={state.selectedPlatformIds.length === 0}
          className="flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
        >
          <span>Continue to File Upload</span>
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
