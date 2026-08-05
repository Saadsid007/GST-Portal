"use client";

import type { MultiConvertState } from "@/features/convert/presentation/convert-workbench";
import { Calendar, ArrowLeft, ArrowRight, Clock } from "lucide-react";
import { formatPeriod } from "@/lib/utils";

interface Props {
  state: MultiConvertState;
  onChange: (updates: Partial<MultiConvertState>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Step2Period({ state, onChange, onNext, onBack }: Props) {
  // Format MMYYYY -> YYYY-MM for HTML month picker
  const monthInputValue =
    state.returnPeriod.length === 6
      ? `${state.returnPeriod.slice(2, 6)}-${state.returnPeriod.slice(0, 2)}`
      : new Date().toISOString().slice(0, 7);

  function handleMonthChange(val: string) {
    const [year, month] = val.split("-");
    if (year && month) {
      onChange({ returnPeriod: `${month}${year}` });
    }
  }

  // Quick month presets
  function selectPresetMonth(monthsAgo: number) {
    const d = new Date();
    d.setMonth(d.getMonth() - monthsAgo);
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = String(d.getFullYear());
    onChange({ returnPeriod: `${month}${year}` });
  }

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold tracking-wider text-primary uppercase">
          Step 2 of 10
        </span>
        <h2 className="mt-2 text-xl font-bold">Select Return Filing Period</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Select the tax period month and year for this GSTR-1 return filing.
        </p>
      </div>

      <div className="max-w-md space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-muted-foreground uppercase">
            <Calendar className="size-4 text-primary" /> Return Month & Year
          </label>
          <input
            type="month"
            value={monthInputValue}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base font-bold focus:ring-2 focus:ring-primary/50 focus:outline-none"
          />
        </div>

        <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3 text-xs">
          <span className="text-muted-foreground">GSTN Return Period Code:</span>
          <span className="rounded border border-border bg-background px-2.5 py-1 font-mono font-bold text-foreground">
            {formatPeriod(state.returnPeriod)} ({state.returnPeriod})
          </span>
        </div>

        {/* Presets */}
        <div className="space-y-2 border-t border-border pt-2">
          <p className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <Clock className="size-3" /> Quick Select:
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => selectPresetMonth(0)}
              className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium transition hover:bg-accent"
            >
              Current Month
            </button>
            <button
              type="button"
              onClick={() => selectPresetMonth(1)}
              className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium transition hover:bg-accent"
            >
              Last Month
            </button>
            <button
              type="button"
              onClick={() => selectPresetMonth(2)}
              className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium transition hover:bg-accent"
            >
              2 Months Ago
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold transition hover:bg-accent sm:w-auto"
        >
          <ArrowLeft className="size-4" /> Back to GST Profile
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={!state.returnPeriod}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-2.5 font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50 sm:w-auto"
        >
          <span>Next: Select Marketplaces</span>
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
