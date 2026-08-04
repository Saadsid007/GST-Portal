"use client";

import type { MultiConvertState } from "@/features/convert/presentation/convert-workbench";
import { PLATFORMS_CONFIG } from "@/features/convert/config/platform.config";
import { ArrowLeft, ArrowRight, ShieldCheck, FileCheck, Info } from "lucide-react";

interface Props {
  state: MultiConvertState;
  onNext: () => void;
  onBack: () => void;
}

export function Step4RulesCheck({ state, onNext, onBack }: Props) {
  const selectedConfigs = PLATFORMS_CONFIG.filter((p) => state.selectedPlatformIds.includes(p.id));

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold tracking-wider text-primary uppercase">
          Step 4 of 10
        </span>
        <h2 className="mt-2 text-xl font-bold">Required Files Detection (Rule Engine)</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Rule Engine detected the required and optional report files for your selected
          marketplace(s).
        </p>
      </div>

      <div className="space-y-4">
        {selectedConfigs.map((plat) => (
          <div key={plat.id} className="space-y-3 rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" />
              <h3 className="text-base font-bold">{plat.name}</h3>
            </div>

            <div className="grid grid-cols-1 gap-3 pt-1 md:grid-cols-2">
              {plat.files.map((f) => (
                <div
                  key={f.id}
                  className="flex items-start gap-3 rounded-xl border border-border bg-background p-3.5"
                >
                  <FileCheck className="mt-0.5 size-4 flex-shrink-0 text-emerald-500" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="truncate text-xs font-bold">{f.name}</p>
                      {f.required ? (
                        <span className="rounded bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-600 uppercase">
                          Required
                        </span>
                      ) : (
                        <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">
                          Optional
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{f.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
        <Info className="size-4 flex-shrink-0 text-primary" />
        <span>
          You will upload these files in the next step. Optional files can be skipped if not
          available.
        </span>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold transition hover:bg-accent"
        >
          <ArrowLeft className="size-4" /> Back to Marketplaces
        </button>

        <button
          type="button"
          onClick={onNext}
          className="flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90"
        >
          <span>Next: Upload Files</span>
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
