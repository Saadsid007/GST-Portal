"use client";

import Link from "next/link";
import { ArrowRight, Building2, Calendar, Check, Plus, Store } from "lucide-react";
import type { GstinProfile } from "@/generated/prisma/client";
import type { MultiConvertState } from "@/features/convert/presentation/convert-workbench";
import { PLATFORMS_CONFIG } from "@/features/convert/config/platform.config";
import { PlatformLogo } from "@/features/convert/presentation/platform-logo";
import { EcoGstinFields } from "@/features/convert/presentation/steps/eco-gstin-fields";
import { GstinPicker } from "@/features/convert/presentation/steps/gstin-picker";
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
 * files each marketplace wants (the upload screen shows the same slots). Each
 * section keeps what its step had: search and filters for GSTINs, presets and
 * a picker for the month, full marketplace cards with operator GSTINs.
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

  const allSelected = state.selectedPlatformIds.length === PLATFORMS_CONFIG.length;
  const ready =
    Boolean(state.gstinNumber) &&
    state.returnPeriod.length === 6 &&
    state.selectedPlatformIds.length > 0;
  const selected = profiles.find((p) => p.gstinNumber === state.gstinNumber);

  return (
    <div className="space-y-8 p-4 sm:p-7">
      {/* GSTIN */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Building2 className="size-4 text-primary-ink" /> GSTIN you are filing for
          </h2>
          <Link
            href="/profile"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary-ink hover:underline"
          >
            <Plus className="size-3.5" /> Add GSTIN
          </Link>
        </div>
        <GstinPicker
          profiles={profiles}
          value={state.gstinNumber}
          onChange={(gstinNumber) => onChange({ gstinNumber })}
        />
      </section>

      {/* Period */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Store className="size-4 text-primary-ink" /> Where did you sell this month?
            </h2>
            <p className="text-xs text-muted-foreground">
              {state.selectedPlatformIds.length} selected — reports from all of them are combined
              into one GSTR-1.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              onChange({
                selectedPlatformIds: allSelected ? [] : PLATFORMS_CONFIG.map((p) => p.id),
              })
            }
            className="rounded-lg border border-dashed border-primary/40 px-3 py-1.5 text-xs font-semibold text-primary-ink hover:bg-primary/5"
          >
            {allSelected ? "Clear all" : "Select all"}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:gap-2.5 lg:grid-cols-3">
          {PLATFORMS_CONFIG.map((plat) => {
            const isSelected = state.selectedPlatformIds.includes(plat.id);
            return (
              <button
                key={plat.id}
                type="button"
                onClick={() => togglePlatform(plat.id)}
                aria-pressed={isSelected}
                className={cn(
                  "group relative flex items-center gap-2.5 overflow-hidden rounded-xl border p-2.5 text-left transition sm:items-start sm:gap-3 sm:p-3.5",
                  isSelected
                    ? "border-primary bg-primary/[0.07] ring-1 ring-primary/25"
                    : "border-border bg-card hover:border-border-strong hover:bg-accent/40"
                )}
              >
                <PlatformLogo
                  id={plat.id}
                  name={plat.name}
                  accentColor={plat.accentColor}
                  size="md"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="line-clamp-2 text-xs font-semibold sm:truncate sm:text-sm">
                      {plat.name}
                    </span>
                    {isSelected && (
                      <span className="flex size-4 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="size-2.5" />
                      </span>
                    )}
                  </span>
                  {/* The description and slot count need room a phone does not have. */}
                  <span className="mt-0.5 line-clamp-2 hidden text-xs text-muted-foreground sm:block">
                    {plat.description}
                  </span>
                  <span className="mt-1.5 hidden rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
                    {plat.files.length} report slot{plat.files.length !== 1 ? "s" : ""}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {state.gstinNumber && state.selectedPlatformIds.length > 0 && (
          <EcoGstinFields
            gstinNumber={state.gstinNumber}
            selectedPlatformIds={state.selectedPlatformIds}
          />
        )}
      </section>

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {selected ? (
            <>
              Filing for{" "}
              <span className="font-semibold text-foreground">
                {selected.tradeName || selected.legalName}
              </span>{" "}
              · {formatPeriod(state.returnPeriod)}
            </>
          ) : (
            "Choose a GSTIN to continue"
          )}
        </p>
        <button
          type="button"
          disabled={!ready}
          onClick={onNext}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50 sm:w-auto"
        >
          Continue to upload <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
