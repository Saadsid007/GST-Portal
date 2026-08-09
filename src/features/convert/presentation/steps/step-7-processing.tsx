"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { MultiConvertState } from "@/features/convert/presentation/convert-workbench";
import { parseMultiPlatformFilesAction } from "@/features/convert/actions/convert.actions";
import { Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  state: MultiConvertState;
  onChange: (updates: Partial<MultiConvertState>) => void;
  onNext: () => void;
  onBack: () => void;
}

const PIPELINE_STAGES = [
  "Raw Excel/CSV File Parsing",
  "Universal Mapping Engine",
  "Transformation Engine (Value Normalization)",
  "Rule Engine (Requirements & Rules)",
  "Merge Engine (Multi-Platform Deduplication)",
  "Net Sales Engine (Sales - Returns Calculation)",
  "Validation Engine (GST Compliance Checks)",
  "Statement Engine (Review Summary Assembly)",
];

export function Step7Processing({ state, onChange, onNext, onBack }: Props) {
  const [completedStage, setCompletedStage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function runPipeline() {
      try {
        for (let i = 0; i < PIPELINE_STAGES.length - 1; i++) {
          if (!mounted) return;
          setCompletedStage(i + 1);
          await new Promise((r) => setTimeout(r, 150));
        }

        const res = await parseMultiPlatformFilesAction(
          state.uploadedFiles,
          state.gstinNumber,
          state.answersByFile
        );

        if (!mounted) return;

        if (!res.success) {
          setError(res.error);
          toast.error(res.error);
          return;
        }

        setCompletedStage(PIPELINE_STAGES.length);
        onChange({
          rows: res.data.rows,
          statement: res.data.statement,
          gstr1Json: res.data.gstr1Json,
          importReports: res.data.importReports,
          gstr1CmpResult: res.data.gstr1CmpResult,
          gstr1CmpLabel: res.data.gstr1CmpLabel,
        });

        toast.success("Pipeline processing complete!");

        const detected = Object.keys(res.data.detectedEcoGstins);
        if (detected.length > 0) {
          toast.info(
            detected.length === 1
              ? "Operator GSTIN detected and saved for future returns"
              : `${detected.length} operator GSTINs detected and saved for future returns`
          );
        }
        setTimeout(() => {
          if (mounted) onNext();
        }, 500);
      } catch (err) {
        if (mounted) {
          const msg = err instanceof Error ? err.message : "Pipeline execution failed";
          setError(msg);
          toast.error(msg);
        }
      }
    }

    runPipeline();

    return () => {
      mounted = false;
    };
    // The pipeline is a one-shot side effect for this mount; re-running it on any prop change
    // would re-parse every uploaded file and double-advance the wizard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const percent = Math.round((completedStage / PIPELINE_STAGES.length) * 100);

  return (
    <div className="mx-auto max-w-xl space-y-8 p-8 text-center md:p-12">
      <div>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold tracking-wider text-primary-ink uppercase">
          Step 7 of 10
        </span>
        <h2 className="mt-3 text-2xl font-bold">Executing Pipeline Engine</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Processing {state.uploadedFiles.length} file(s) through our 8-stage normalization
          pipeline.
        </p>
      </div>

      {!error && (
        <div className="space-y-2">
          {/* Ring counter — the pipeline is fast, so the number is the reassurance. */}
          <div className="relative mx-auto size-24">
            <svg viewBox="0 0 100 100" className="size-full -rotate-90">
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                strokeWidth="8"
                className="stroke-muted"
                strokeLinecap="round"
              />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                strokeWidth="8"
                strokeLinecap="round"
                className="stroke-primary transition-all duration-300 ease-out"
                strokeDasharray={2 * Math.PI * 42}
                strokeDashoffset={2 * Math.PI * 42 * (1 - percent / 100)}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-lg font-extrabold text-primary-ink">
              {percent}%
            </span>
          </div>
          <p className="text-xs font-semibold text-muted-foreground">
            Stage {Math.min(completedStage + 1, PIPELINE_STAGES.length)} of {PIPELINE_STAGES.length}
          </p>
        </div>
      )}

      {error ? (
        <div className="space-y-4 rounded-2xl border border-destructive/30 bg-destructive/10 p-6">
          <p className="text-sm font-bold text-destructive">Processing Error</p>
          <p className="text-xs text-muted-foreground">{error}</p>
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border border-border bg-background px-4 py-2 text-xs font-bold transition hover:bg-accent"
          >
            Go Back & Fix Uploads
          </button>
        </div>
      ) : (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-6 text-left shadow-sm">
          {PIPELINE_STAGES.map((stageName, idx) => {
            const isDone = completedStage > idx;
            const isCurrent = completedStage === idx;

            return (
              <div
                key={stageName}
                className={cn(
                  "relative flex items-center gap-3 overflow-hidden rounded-lg p-2 transition-all duration-300",
                  isCurrent && "bg-primary/10",
                  isDone && "bg-success/5"
                )}
              >
                {isCurrent && (
                  <span
                    aria-hidden
                    className="absolute inset-y-0 -left-1/4 w-1/4 animate-sweep bg-gradient-to-r from-transparent via-primary/20 to-transparent"
                  />
                )}
                {isDone ? (
                  <CheckCircle2 className="relative size-4 flex-shrink-0 text-success" />
                ) : isCurrent ? (
                  <Loader2 className="relative size-4 flex-shrink-0 animate-spin text-primary-ink" />
                ) : (
                  <div className="relative size-4 flex-shrink-0 rounded-full border border-muted-foreground/30" />
                )}
                <span
                  className={cn(
                    "relative text-xs font-semibold transition-colors",
                    isDone && "text-foreground",
                    isCurrent && "font-bold text-primary-ink",
                    !isDone && !isCurrent && "text-muted-foreground/60"
                  )}
                >
                  {stageName}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
