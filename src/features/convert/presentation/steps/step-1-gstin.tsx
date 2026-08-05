"use client";

import type { GstinProfile } from "@/generated/prisma/client";
import type { MultiConvertState } from "@/features/convert/presentation/convert-workbench";
import { Building2, ArrowRight, CheckCircle, Plus } from "lucide-react";
import Link from "next/link";

interface Props {
  state: MultiConvertState;
  profiles: GstinProfile[];
  onChange: (updates: Partial<MultiConvertState>) => void;
  onNext: () => void;
}

export function Step1Gstin({ state, profiles, onChange, onNext }: Props) {
  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold tracking-wider text-primary uppercase">
            Step 1 of 10
          </span>
          <h2 className="mt-2 text-xl font-bold">Select GST Profile</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Choose the registered GSTIN profile for which you are generating this GSTR-1 return.
          </p>
        </div>
        <Link
          href="/profile"
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-primary/40 px-3 py-1.5 text-xs font-semibold text-primary hover:underline sm:w-auto"
        >
          <Plus className="size-3.5" /> Add New GSTIN
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {profiles.map((p) => {
          const isSelected = state.gstinNumber === p.gstinNumber;
          return (
            <button
              type="button"
              key={p.id}
              onClick={() => onChange({ gstinNumber: p.gstinNumber })}
              className={`relative rounded-2xl border p-5 text-left transition-all ${
                isSelected
                  ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/20"
                  : "border-border bg-card hover:border-primary/40 hover:bg-accent/40"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex size-10 items-center justify-center rounded-xl ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                  >
                    <Building2 className="size-5" />
                  </div>
                  <div>
                    <p className="text-base font-bold">{p.legalName}</p>
                    {p.tradeName && <p className="text-xs text-muted-foreground">{p.tradeName}</p>}
                  </div>
                </div>
                {isSelected && <CheckCircle className="size-5 text-primary" />}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 font-mono text-xs">
                <span className="font-semibold text-muted-foreground">GSTIN: {p.gstinNumber}</span>
                <span className="rounded bg-muted px-2.5 py-0.5 text-muted-foreground">
                  {p.stateName} ({p.stateCode})
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex justify-end border-t border-border pt-4">
        <button
          type="button"
          onClick={onNext}
          disabled={!state.gstinNumber}
          className="flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
        >
          <span>Next: Return Filing Period</span>
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
