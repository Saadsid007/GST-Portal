"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PLATFORMS_CONFIG } from "@/features/convert/config/platform.config";
import type { MultiConvertState } from "@/features/convert/presentation/convert-workbench";
import type { MultiUploadFileInput } from "@/features/convert/types/convert.types";
import { parseMultiPlatformFilesAction } from "@/features/convert/actions/convert.actions";
import { cn } from "@/lib/utils";
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Trash2,
  AlertCircle,
} from "lucide-react";

interface Props {
  state: MultiConvertState;
  onChange: (updates: Partial<MultiConvertState>) => void;
  onNext: () => void;
  onBack: () => void;
}

interface SelectedFileItem {
  platformId: string;
  fileTypeId: string;
  file: File;
}

export function StepUpload({ state, onChange, onNext, onBack }: Props) {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFileItem[]>([]);
  const [parsing, setParsing] = useState(false);

  const selectedConfigs = PLATFORMS_CONFIG.filter((p) => state.selectedPlatformIds.includes(p.id));

  function handleFileSelect(platformId: string, fileTypeId: string, file: File) {
    setSelectedFiles((prev) => {
      // Remove any existing file for this platformId + fileTypeId
      const filtered = prev.filter(
        (f) => !(f.platformId === platformId && f.fileTypeId === fileTypeId)
      );
      return [...filtered, { platformId, fileTypeId, file }];
    });
  }

  function handleRemoveFile(platformId: string, fileTypeId: string) {
    setSelectedFiles((prev) =>
      prev.filter((f) => !(f.platformId === platformId && f.fileTypeId === fileTypeId))
    );
  }

  async function handleProcessAll() {
    if (selectedFiles.length === 0) {
      toast.error("Please upload at least one report file before proceeding");
      return;
    }

    setParsing(true);
    try {
      const fileInputs: MultiUploadFileInput[] = selectedFiles.map((item) => ({
        platformId: item.platformId,
        fileTypeId: item.fileTypeId,
        fileName: item.file.name,
        file: item.file,
      }));

      const res = await parseMultiPlatformFilesAction(fileInputs, state.gstinNumber);

      if (!res.success) {
        toast.error(res.error);
        return;
      }

      onChange({
        uploadedFiles: fileInputs,
        rows: res.data.rows,
        statement: res.data.statement,
        gstr1Json: res.data.gstr1Json,
      });

      toast.success(
        `Successfully parsed ${res.data.totalFilesProcessed} file(s) across ${state.selectedPlatformIds.length} marketplace(s)!`
      );
      onNext();
    } catch {
      toast.error("Failed to parse uploaded Excel files");
    } finally {
      setParsing(false);
    }
  }

  return (
    <div className="space-y-8 p-6 md:p-8">
      <div>
        <h2 className="text-xl font-bold">Upload Reports for Selected Marketplaces</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload the sales, return, or credit note reports for each selected marketplace. All data
          will be parsed and merged into a single Net Sales statement.
        </p>
      </div>

      {/* Platform File Upload Cards */}
      <div className="space-y-6">
        {selectedConfigs.map((plat) => (
          <div key={plat.id} className="space-y-4 rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`size-8 rounded-lg bg-gradient-to-br ${plat.accentColor} flex items-center justify-center text-xs font-bold text-white`}
                >
                  <FileSpreadsheet className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">{plat.name}</h3>
                  <p className="text-xs text-muted-foreground">{plat.description}</p>
                </div>
              </div>
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                {plat.files.length} report slot{plat.files.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* File Dropzone Slots */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {plat.files.map((fileSlot) => {
                const existing = selectedFiles.find(
                  (f) => f.platformId === plat.id && f.fileTypeId === fileSlot.id
                );

                return (
                  <div
                    key={fileSlot.id}
                    className={cn(
                      "relative rounded-xl border border-dashed p-4 transition-all",
                      existing
                        ? "border-success/50 bg-success/5"
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
                            <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive uppercase">
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
                          onClick={() => handleRemoveFile(plat.id, fileSlot.id)}
                          className="rounded p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                          title="Remove file"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>

                    {existing ? (
                      <div className="mt-3 flex items-center gap-2 rounded-lg border border-success/30 bg-background p-2">
                        <CheckCircle className="size-4 flex-shrink-0 text-success" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium">{existing.file.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {(existing.file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
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
                            if (file) handleFileSelect(plat.id, fileSlot.id, file);
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

      {/* Upload summary banner */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 p-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="size-4 flex-shrink-0 text-primary-ink" />
          <p className="text-xs text-muted-foreground">
            Total files attached:{" "}
            <span className="font-bold text-foreground">{selectedFiles.length}</span> file(s) across{" "}
            <span className="font-bold text-foreground">{selectedConfigs.length}</span> platform(s).
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between border-t border-border pt-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold transition hover:bg-accent"
        >
          <ArrowLeft className="size-4" /> Back to Setup
        </button>

        <button
          type="button"
          onClick={handleProcessAll}
          disabled={selectedFiles.length === 0 || parsing}
          className="flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
        >
          {parsing ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              <span>Parsing & Merging Reports...</span>
            </>
          ) : (
            <>
              <span>Process All Reports & Calculate Net Sales</span>
              <ArrowRight className="size-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
