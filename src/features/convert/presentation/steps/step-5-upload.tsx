"use client";

import { PLATFORMS_CONFIG } from "@/features/convert/config/platform.config";
import type { MultiConvertState } from "@/features/convert/presentation/convert-workbench";
import type { MultiUploadFileInput } from "@/features/convert/types/convert.types";
import { CompletenessChecker } from "@/features/convert/engine/rules/completeness.checker";
import { PlatformDetector } from "@/features/convert/engine/detection/platform.detector";
import { cn } from "@/lib/utils";
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Trash2,
  AlertTriangle,
  Sparkles,
} from "lucide-react";

interface Props {
  state: MultiConvertState;
  onChange: (updates: Partial<MultiConvertState>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Step5Upload({ state, onChange, onNext, onBack }: Props) {
  const selectedConfigs = PLATFORMS_CONFIG.filter((p) => state.selectedPlatformIds.includes(p.id));
  const completeness = CompletenessChecker.checkCompleteness(
    state.selectedPlatformIds,
    state.uploadedFiles
  );

  function handleFileAdd(platformId: string, fileTypeId: string, file: File) {
    const newInput: MultiUploadFileInput = {
      platformId,
      fileTypeId,
      fileName: file.name,
      file,
    };

    const filtered = state.uploadedFiles.filter(
      (f) => !(f.platformId === platformId && f.fileTypeId === fileTypeId)
    );

    onChange({ uploadedFiles: [...filtered, newInput] });
  }

  function handleFileRemove(platformId: string, fileTypeId: string) {
    const filtered = state.uploadedFiles.filter(
      (f) => !(f.platformId === platformId && f.fileTypeId === fileTypeId)
    );
    onChange({ uploadedFiles: filtered });
  }

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold tracking-wider text-primary uppercase">
          Step 5 of 10
        </span>
        <h2 className="mt-2 text-xl font-bold">Upload Marketplace Report Files</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Attach report files for each marketplace slot below. Auto-Detection Engine will verify
          your files.
        </p>
      </div>

      {/* Completeness Warnings */}
      {!completeness.isComplete && (
        <div className="space-y-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-700 dark:text-amber-400">
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle className="size-4 flex-shrink-0 text-amber-500" />
            <span>Upload Completeness Warning</span>
          </div>
          <ul className="list-inside list-disc space-y-1 pl-1">
            {completeness.warnings.map((w, idx) => (
              <li key={idx}>{w.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-6">
        {selectedConfigs.map((plat) => (
          <div
            key={plat.id}
            className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-3">
                <div
                  className={`size-9 rounded-xl bg-gradient-to-br ${plat.accentColor} flex items-center justify-center text-xs font-bold text-white shadow-sm`}
                >
                  <FileSpreadsheet className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">{plat.name}</h3>
                  <p className="text-xs text-muted-foreground">{plat.description}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {plat.files.map((fileSlot) => {
                const existing = state.uploadedFiles.find(
                  (f) => f.platformId === plat.id && f.fileTypeId === fileSlot.id
                );

                const detection = existing
                  ? PlatformDetector.detect(
                      [fileSlot.name, "invoice_number", "taxable_value"],
                      fileSlot.name,
                      existing.fileName
                    )
                  : null;

                return (
                  <div
                    key={fileSlot.id}
                    className={cn(
                      "relative rounded-xl border border-dashed p-4 transition-all",
                      existing
                        ? "border-emerald-500/50 bg-emerald-500/5"
                        : fileSlot.required
                          ? "border-border bg-background hover:border-primary/50"
                          : "border-border/60 bg-muted/20 hover:border-primary/40"
                    )}
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold">{fileSlot.name}</p>
                          {fileSlot.required ? (
                            <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-bold text-red-600 uppercase">
                              Required
                            </span>
                          ) : (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">
                              Optional
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {fileSlot.description}
                        </p>
                      </div>

                      {existing && (
                        <button
                          type="button"
                          onClick={() => handleFileRemove(plat.id, fileSlot.id)}
                          className="rounded p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                          title="Remove file"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>

                    {existing ? (
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-background p-2.5">
                          <CheckCircle className="size-4 flex-shrink-0 text-emerald-500" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-bold">{existing.fileName}</p>
                            <p className="text-[10px] text-muted-foreground">
                              Ready for processing
                            </p>
                          </div>
                        </div>

                        {detection && (
                          <div className="flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary">
                            <Sparkles className="size-3" />
                            <span>
                              Detected: {detection.platformName} ({detection.parserVersion}) —{" "}
                              {detection.confidence}% Confidence
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card py-3 transition hover:bg-accent">
                        <UploadCloud className="size-4 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">
                          Choose Excel / CSV
                        </span>
                        <input
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileAdd(plat.id, fileSlot.id, file);
                          }}
                        />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold transition hover:bg-accent"
        >
          <ArrowLeft className="size-4" /> Back to Rules Check
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={state.uploadedFiles.length === 0}
          className="flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
        >
          <span>Next: Column Mapping & Preview</span>
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
