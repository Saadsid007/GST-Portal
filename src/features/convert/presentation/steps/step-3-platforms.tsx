"use client";

import type { MultiConvertState } from "@/features/convert/presentation/convert-workbench";
import { EcoGstinFields } from "@/features/convert/presentation/steps/eco-gstin-fields";
import { PLATFORMS_CONFIG } from "@/features/convert/config/platform.config";
import { cn } from "@/lib/utils";
import {
  Check,
  ArrowLeft,
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
  onChange: (updates: Partial<MultiConvertState>) => void;
  onNext: () => void;
  onBack: () => void;
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

export function Step3Platforms({ state, onChange, onNext, onBack }: Props) {
  function togglePlatform(id: string) {
    const current = state.selectedPlatformIds;
    if (current.includes(id)) {
      if (current.length === 1) return;
      onChange({ selectedPlatformIds: current.filter((p) => p !== id) });
    } else {
      onChange({ selectedPlatformIds: [...current, id] });
    }
  }

  function selectAll() {
    onChange({ selectedPlatformIds: PLATFORMS_CONFIG.map((p) => p.id) });
  }

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold tracking-wider text-primary-ink uppercase">
            Step 3 of 10
          </span>
          <h2 className="mt-2 text-xl font-bold">
            Select Marketplaces ({state.selectedPlatformIds.length} selected)
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Select one or multiple platforms. Reports from all selected marketplaces will be
            combined into a single GSTR-1 return.
          </p>
        </div>
        <button
          type="button"
          onClick={selectAll}
          className="w-full rounded-lg border border-dashed border-primary/40 px-3 py-1.5 text-xs font-bold text-primary-ink hover:underline sm:w-auto"
        >
          Select All Platforms
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
              aria-pressed={isSelected}
              className={cn(
                "group relative flex items-start gap-3 overflow-hidden rounded-2xl border p-4 text-left transition-all duration-200",
                isSelected
                  ? "-translate-y-0.5 border-primary bg-primary/5 shadow-md ring-2 ring-primary/20"
                  : "border-border bg-card hover:-translate-y-0.5 hover:border-primary/40 hover:bg-accent/40 hover:shadow-sm"
              )}
            >
              {/* Selected cards carry a brand stripe so the state survives a squint test. */}
              <span
                aria-hidden
                className={cn(
                  "absolute inset-y-0 left-0 w-1 brand-gradient transition-opacity duration-200",
                  isSelected ? "opacity-100" : "opacity-0"
                )}
              />
              <div
                className={cn(
                  "flex size-10 flex-shrink-0 items-center justify-center rounded-xl transition-all duration-200",
                  isSelected
                    ? "brand-gradient text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground group-hover:scale-110 group-hover:bg-primary/10 group-hover:text-primary-ink"
                )}
              >
                <IconComponent className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-bold">{plat.name}</p>
                  {isSelected && (
                    <span className="flex size-4 flex-shrink-0 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                      <Check className="size-2.5" />
                    </span>
                  )}
                </div>
                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                  {plat.description}
                </p>
                <span className="mt-2 inline-block rounded bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {plat.files.length} report slot{plat.files.length !== 1 ? "s" : ""}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <EcoGstinFields
        gstinNumber={state.gstinNumber}
        selectedPlatformIds={state.selectedPlatformIds}
      />

      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold transition hover:bg-accent sm:w-auto"
        >
          <ArrowLeft className="size-4" /> Back to Period
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={state.selectedPlatformIds.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-xl brand-gradient px-6 py-2.5 font-bold text-primary-foreground shadow-accent transition hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
        >
          <span>Next: Required Files Detection</span>
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
