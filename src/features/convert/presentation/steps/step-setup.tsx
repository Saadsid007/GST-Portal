"use client";

import Link from "next/link";
import { ArrowRight, Building2, Calendar, Check, Plus, Store } from "lucide-react";
import type { GstinProfile } from "@/generated/prisma/client";
import type { MultiConvertState } from "@/features/convert/presentation/convert-workbench";
import { PLATFORMS_CONFIG } from "@/features/convert/config/platform.config";
import { PlatformLogo } from "@/features/convert/presentation/platform-logo";
import { EcoGstinFields } from "@/features/convert/presentation/steps/eco-gstin-fields";
import { cn, formatPeriod } from "@/lib/utils";

interface Props {
  state: MultiConvertState;
  profiles: GstinProfile[];
  onChange: (updates: Partial<MultiConvertState>) => void;
  onNext: () => void;
}

/** MMYYYY for the month `monthsAgo` months before this one. */
export function periodMonthsAgo(monthsAgo: number, now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  return `${String(d.getMonth() + 1).padStart(2, "0")}${d.getFullYear()}`;
}

/**
 * Who, which month, which marketplaces — on one screen.
 *
 * These were three steps of their own, plus a fourth that only listed the
 * files each marketplace wants (the upload screen shows the same slots). A
 * seller filing the same GSTIN every month clicked through four screens before
 * reaching the upload; most of the time all three answers are already right.
 */
export function StepSetup({ state, profiles, onChange, onNext }: Props) {
  const monthValue =
    state.returnPeriod.length === 6
      ? `${state.returnPeriod.slice(2)}-${state.returnPeriod.slice(0, 2)}`
      : "";

  function togglePlatform(id: string) {
    const current = state.selectedPlatformIds;
    onChange({
      selectedPlatformIds: current.includes(id)
        ? current.filter((p) => p !== id)
        : [...current, id],
    });
  }

  const ready =
    Boolean(state.gstinNumber) &&
    state.returnPeriod.length === 6 &&
    state.selectedPlatformIds.length > 0;

  return (
    <div className="space-y-7 p-5 sm:p-7">
      {/* GSTIN */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Building2 className="size-4 text-primary-ink" /> GSTIN you are filing for
          </h2>
          <Link
            href="/profile"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary-ink hover:underline"
          >
            <Plus className="size-3.5" /> Add GSTIN
          </Link>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {profiles.map((p) => {
            const selected = p.gstinNumber === state.gstinNumber;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onChange({ gstinNumber: p.gstinNumber })}
                aria-pressed={selected}
                className={cn(
                  "flex items-start justify-between gap-2 rounded-xl border p-3 text-left transition",
                  selected
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-border-strong hover:bg-accent/50"
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {p.tradeName || p.legalName}
                  </span>
                  <span className="block font-mono text-xs text-muted-foreground">
                    {p.gstinNumber}
                  </span>
                  <span className="block text-2xs text-muted-foreground">{p.stateName}</span>
                </span>
                {selected && <Check className="size-4 shrink-0 text-primary-ink" />}
              </button>
            );
          })}
        </div>
      </section>

      {/* Period */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Calendar className="size-4 text-primary-ink" /> Return month
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {[1, 0, 2].map((ago) => {
            const period = periodMonthsAgo(ago);
            return (
              <button
                key={ago}
                type="button"
                onClick={() => onChange({ returnPeriod: period })}
                aria-pressed={state.returnPeriod === period}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm font-medium transition",
                  state.returnPeriod === period
                    ? "border-primary bg-primary/10 text-primary-ink"
                    : "border-border hover:bg-accent/50"
                )}
              >
                {formatPeriod(period)}
                {ago === 1 && <span className="ml-1.5 text-2xs text-muted-foreground">usual</span>}
              </button>
            );
          })}
          <input
            type="month"
            value={monthValue}
            aria-label="Pick another month"
            onChange={(e) => {
              const [year, month] = e.target.value.split("-");
              if (year && month) onChange({ returnPeriod: `${month}${year}` });
            }}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:ring-2 focus:ring-ring/30 focus:outline-none"
          />
        </div>
      </section>

      {/* Marketplaces */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Store className="size-4 text-primary-ink" /> Where did you sell this month?
          </h2>
          <span className="text-xs text-muted-foreground">Pick all that apply</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {PLATFORMS_CONFIG.map((p) => {
            const selected = state.selectedPlatformIds.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => togglePlatform(p.id)}
                aria-pressed={selected}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition",
                  selected
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-border-strong hover:bg-accent/50"
                )}
              >
                <PlatformLogo id={p.id} name={p.name} accentColor={p.accentColor} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {p.name.replace(
                    / (Seller|Partner|Supplier Panel|Seller Hub|Partner Portal)( MTR)?$/,
                    ""
                  )}
                </span>
                {selected && <Check className="size-4 shrink-0 text-primary-ink" />}
              </button>
            );
          })}
        </div>
        {state.gstinNumber && state.selectedPlatformIds.length > 0 && (
          <details className="group rounded-xl border border-border bg-subtle px-3 py-2">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground select-none group-open:mb-2">
              Advanced: marketplace GSTINs for Table 14 (filled in for you)
            </summary>
            <EcoGstinFields
              gstinNumber={state.gstinNumber}
              selectedPlatformIds={state.selectedPlatformIds}
            />
          </details>
        )}
      </section>

      <div className="flex justify-end border-t border-border pt-5">
        <button
          type="button"
          disabled={!ready}
          onClick={onNext}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          Continue to upload <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
