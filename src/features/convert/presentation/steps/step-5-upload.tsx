"use client";

import { useState } from "react";
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

const ACCEPTED = [".xlsx", ".xls", ".csv"];

function isAccepted(fileName: string) {
  return ACCEPTED.some((ext) => fileName.toLowerCase().endsWith(ext));
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function Step5Upload({ state, onChange, onNext, onBack }: Props) {
  const selectedConfigs = PLATFORMS_CONFIG.filter((p) => state.selectedPlatformIds.includes(p.id));
  const completeness = CompletenessChecker.checkCompleteness(
    state.selectedPlatformIds,
    state.uploadedFiles
  );

  const requiredSlots = selectedConfigs.flatMap((p) =>
    p.files.filter((f) => f.required).map((f) => ({ platformId: p.id, fileTypeId: f.id }))
  );
  const filledRequired = requiredSlots.filter((slot) =>
    state.uploadedFiles.some(
      (f) => f.platformId === slot.platformId && f.fileTypeId === slot.fileTypeId
    )
  ).length;
  const requiredPercent =
    requiredSlots.length === 0 ? 100 : Math.round((filledRequired / requiredSlots.length) * 100);

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold tracking-wider text-primary-ink uppercase">
            Step 5 of 10
          </span>
          <h2 className="mt-2 text-xl font-bold">Upload Marketplace Report Files</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Drag a file onto a slot or click to browse. The Auto-Detection Engine verifies each file
            as it lands.
          </p>
        </div>

        {/* Required-slot meter: the one number that decides whether Next is safe. */}
        <div className="w-full min-w-[180px] space-y-1.5 sm:w-auto">
          <div className="flex items-center justify-between gap-4 text-[11px] font-semibold">
            <span className="text-muted-foreground uppercase">Required files</span>
            <span className={requiredPercent === 100 ? "text-success" : "text-primary-ink"}>
              {filledRequired}/{requiredSlots.length}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                requiredPercent === 100 ? "bg-success" : "brand-gradient"
              )}
              style={{ width: `${Math.max(requiredPercent, 3)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Completeness Warnings */}
      {!completeness.isComplete && (
        <div className="space-y-2 rounded-2xl border border-warning/30 bg-warning/10 p-4 text-xs text-warning">
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle className="size-4 flex-shrink-0 text-warning" />
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
        {selectedConfigs.map((plat) => {
          const platFiles = plat.files.filter((f) =>
            state.uploadedFiles.some((u) => u.platformId === plat.id && u.fileTypeId === f.id)
          );

          return (
            <div
              key={plat.id}
              className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={`size-9 rounded-xl bg-gradient-to-br ${plat.accentColor} flex flex-shrink-0 items-center justify-center text-xs font-bold text-white shadow-sm`}
                  >
                    <FileSpreadsheet className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold">{plat.name}</h3>
                    <p className="truncate text-xs text-muted-foreground">{plat.description}</p>
                  </div>
                </div>
                <span
                  className={cn(
                    "flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold whitespace-nowrap",
                    platFiles.length > 0
                      ? "bg-success/10 text-success"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {platFiles.length}/{plat.files.length} attached
                </span>
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
                    <FileDropSlot
                      key={fileSlot.id}
                      slotName={fileSlot.name}
                      slotDescription={fileSlot.description}
                      required={fileSlot.required}
                      existing={existing}
                      detection={detection}
                      onAdd={(file) => handleFileAdd(plat.id, fileSlot.id, file)}
                      onRemove={() => handleFileRemove(plat.id, fileSlot.id)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold transition hover:bg-accent sm:w-auto"
        >
          <ArrowLeft className="size-4" /> Back to Rules Check
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={state.uploadedFiles.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-xl brand-gradient px-6 py-2.5 font-bold text-primary-foreground shadow-accent transition hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
        >
          <span>Next: Column Mapping &amp; Preview</span>
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

interface SlotProps {
  slotName: string;
  slotDescription: string;
  required: boolean;
  existing: MultiUploadFileInput | undefined;
  detection: { platformName: string; parserVersion: string; confidence: number } | null;
  onAdd: (file: File) => void;
  onRemove: () => void;
}

function FileDropSlot({
  slotName,
  slotDescription,
  required,
  existing,
  detection,
  onAdd,
  onRemove,
}: SlotProps) {
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState<string | null>(null);

  function accept(file: File | undefined) {
    if (!file) return;
    if (!isAccepted(file.name)) {
      setRejected(`${file.name} is not an Excel or CSV file`);
      return;
    }
    setRejected(null);
    onAdd(file);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        accept(e.dataTransfer.files?.[0]);
      }}
      className={cn(
        "relative rounded-xl border border-dashed p-4 transition-all duration-200",
        dragging && "scale-[1.01] border-primary bg-primary/10 ring-2 ring-primary/30",
        !dragging && existing && "border-success/50 bg-success/5",
        !dragging && !existing && required && "border-border bg-background hover:border-primary/50",
        !dragging &&
          !existing &&
          !required &&
          "border-border/60 bg-muted/20 hover:border-primary/40"
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-xs font-bold">{slotName}</p>
            {required ? (
              <span className="flex-shrink-0 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold text-destructive uppercase">
                Required
              </span>
            ) : (
              <span className="flex-shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">
                Optional
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{slotDescription}</p>
        </div>

        {existing && (
          <button
            type="button"
            onClick={onRemove}
            className="flex-shrink-0 rounded p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
            title="Remove file"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>

      {existing ? (
        <div className="mt-3 space-y-2">
          <div className="flex animate-rise items-center gap-2 rounded-lg border border-success/30 bg-background p-2.5">
            <CheckCircle className="size-4 flex-shrink-0 text-success" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold">{existing.fileName}</p>
              <p className="text-[10px] text-muted-foreground">
                {formatBytes(existing.file.size)} · ready for processing
              </p>
            </div>
          </div>

          {detection && (
            <div className="flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary-ink">
              <Sparkles className="size-3 flex-shrink-0" />
              <span>
                Detected: {detection.platformName} ({detection.parserVersion}) —{" "}
                {detection.confidence}% Confidence
              </span>
            </div>
          )}
        </div>
      ) : (
        <label
          className={cn(
            "group mt-3 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed py-4 transition",
            dragging
              ? "border-primary bg-primary/10"
              : "border-border bg-card hover:border-primary/50 hover:bg-accent"
          )}
        >
          <UploadCloud
            className={cn(
              "size-5 transition-transform",
              dragging
                ? "scale-125 text-primary-ink"
                : "text-muted-foreground group-hover:scale-110"
            )}
          />
          <span className="text-xs font-semibold text-muted-foreground">
            {dragging ? "Drop to attach" : "Drop file here or click to browse"}
          </span>
          <span className="text-[10px] text-muted-foreground/70">.xlsx · .xls · .csv</span>
          <input
            type="file"
            accept={ACCEPTED.join(",")}
            className="hidden"
            onChange={(e) => accept(e.target.files?.[0])}
          />
        </label>
      )}

      {rejected && (
        <p className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-destructive">
          <AlertTriangle className="size-3 flex-shrink-0" /> {rejected}
        </p>
      )}
    </div>
  );
}
