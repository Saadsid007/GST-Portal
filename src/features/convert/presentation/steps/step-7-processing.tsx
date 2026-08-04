"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { MultiConvertState } from "@/features/convert/presentation/convert-workbench";
import { parseMultiPlatformFilesAction } from "@/features/convert/actions/convert.actions";
import { Loader2, CheckCircle2 } from "lucide-react";

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

        const res = await parseMultiPlatformFilesAction(state.uploadedFiles, state.gstinNumber);

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

  return (
    <div className="mx-auto max-w-xl space-y-8 p-8 text-center md:p-12">
      <div>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold tracking-wider text-primary uppercase">
          Step 7 of 10
        </span>
        <h2 className="mt-3 text-2xl font-bold">Executing Pipeline Engine</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Processing {state.uploadedFiles.length} file(s) through our 8-stage normalization
          pipeline.
        </p>
      </div>

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
              <div key={stageName} className="flex items-center gap-3 rounded-lg p-2 transition">
                {isDone ? (
                  <CheckCircle2 className="size-4 flex-shrink-0 text-emerald-500" />
                ) : isCurrent ? (
                  <Loader2 className="size-4 flex-shrink-0 animate-spin text-primary" />
                ) : (
                  <div className="size-4 flex-shrink-0 rounded-full border border-muted-foreground/30" />
                )}
                <span
                  className={`text-xs font-semibold ${isDone ? "text-foreground" : isCurrent ? "font-bold text-primary" : "text-muted-foreground/60"}`}
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
