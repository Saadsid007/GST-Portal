"use client";

import { useState } from "react";
import type { MultiConvertState } from "@/features/convert/presentation/convert-workbench";
import {
  CANONICAL_FIELDS,
  type ColumnMappingDict,
} from "@/features/convert/engine/mapping/mapping.templates";
import { MappingEngine } from "@/features/convert/engine/mapping/mapping.engine";
import { saveMappingProfileAction } from "@/features/convert/actions/mapping.actions";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  Upload,
  Save,
  Sparkles,
  AlertCircle,
  Cpu,
} from "lucide-react";

interface Props {
  state: MultiConvertState;
  onChange: (updates: Partial<MultiConvertState>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Step6Mapping({ state, onNext, onBack }: Props) {
  const [profileName, setProfileName] = useState("My Custom Mapping Profile");
  const [saving, setSaving] = useState(false);

  // Sample headers and rows for hybrid analysis
  const sampleHeaders = [
    "Invoice Number",
    "Invoice Date",
    "Buyer GSTIN",
    "Buyer Name",
    "Ship To State",
    "HSN Code",
    "Quantity",
    "Taxable Value",
    "CGST Amount",
    "SGST Amount",
    "IGST Amount",
    "Invoice Amount",
  ];

  // Hybrid Intelligent Import Mapping
  const [hybridResult, setHybridResult] = useState(() => {
    return MappingEngine.runHybridMapping(sampleHeaders, state.selectedPlatformIds[0]);
  });

  const [mapping, setMapping] = useState<ColumnMappingDict>(hybridResult.mapping);
  const validation = MappingEngine.validateMapping(mapping);

  function handleFieldChange(canonicalKey: string, rawHeader: string) {
    const updated = { ...mapping, [canonicalKey]: rawHeader };
    setMapping(updated);
    setHybridResult(MappingEngine.runHybridMapping(sampleHeaders, state.selectedPlatformIds[0]));
  }

  function handleExportJson() {
    const jsonStr = MappingEngine.exportMappingJson(mapping, profileName);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${profileName.replace(/\s+/g, "_")}_Mapping.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Mapping profile exported!");
  }

  function handleImportJson(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const imported = MappingEngine.importMappingJson(text);
        setMapping(imported.mappings);
        setProfileName(imported.name);
        toast.success("Mapping profile imported!");
      } catch {
        toast.error("Invalid mapping JSON file");
      }
    };
    reader.readAsText(file);
  }

  async function handleSaveToDb() {
    setSaving(true);
    try {
      const res = await saveMappingProfileAction({
        name: profileName,
        platformId: state.selectedPlatformIds[0] || "custom",
        mappings: mapping,
        isDefault: true,
      });

      if (res.success) {
        toast.success("Mapping profile saved to memory for future uploads!");
      }
    } catch {
      toast.error("Failed to save mapping profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold tracking-wider text-primary uppercase">
              Step 6 of 10
            </span>
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600">
              <Cpu className="size-3" /> Hybrid Intelligent Import Engine
            </span>
          </div>
          <h2 className="mt-2 text-xl font-bold">Universal Mapping Engine & Confidence Scoring</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            5-layer semantic mapping automatically detected column bindings with pattern validation.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold transition hover:bg-accent">
            <Upload className="size-3.5" />
            <span>Import JSON</span>
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImportJson(file);
              }}
            />
          </label>

          <button
            type="button"
            onClick={handleExportJson}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold transition hover:bg-accent"
          >
            <Download className="size-3.5" />
            <span>Export JSON</span>
          </button>

          <button
            type="button"
            onClick={handleSaveToDb}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            <Save className="size-3.5" />
            <span>{saving ? "Saving..." : "Remember Mappings"}</span>
          </button>
        </div>
      </div>

      {/* Validation Status & Confidence Banner */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div
          className={`flex items-center justify-between rounded-xl border p-4 text-xs ${
            validation.isValid
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
          }`}
        >
          <div className="flex items-center gap-2">
            {validation.isValid ? (
              <CheckCircle2 className="size-4" />
            ) : (
              <AlertCircle className="size-4" />
            )}
            <span>
              {validation.isValid
                ? `All required fields mapped cleanly (${validation.mappedFieldsCount} fields active)`
                : `Missing required fields: ${validation.missingRequiredFields.join(", ")}`}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 p-4 text-xs">
          <div className="flex items-center gap-2 font-bold text-primary">
            <Sparkles className="size-4" />
            <span>Overall Engine Confidence: {hybridResult.overallConfidence}%</span>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground">
            {hybridResult.usedSavedMemory
              ? "Memory Profile Used"
              : "Deterministic + AI Pattern Match"}
          </span>
        </div>
      </div>

      {/* Column Mapping Table */}
      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[720px] text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left font-bold text-muted-foreground">
              <th className="px-4 py-3">Canonical GSTR-1 Field</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Mapped Raw Header</th>
              <th className="px-4 py-3 text-center">Confidence / Layer</th>
              <th className="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {CANONICAL_FIELDS.map((field) => {
              const mappedValue = mapping[field.key] || "";
              const isMapped = !!mappedValue;
              const confInfo = hybridResult.fieldConfidences.find(
                (c) => c.targetField === field.key
              );

              return (
                <tr
                  key={field.key}
                  className="border-b border-border transition last:border-0 hover:bg-accent/40"
                >
                  <td className="px-4 py-3 font-bold">
                    <div className="flex items-center gap-2">
                      <span>{field.label}</span>
                      {field.required && <span className="font-bold text-red-500">*</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{field.description}</td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={mappedValue}
                      placeholder={`Auto-detected: ${field.aliases[0]}`}
                      onChange={(e) => handleFieldChange(field.key, e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-1.5 font-mono text-xs focus:ring-2 focus:ring-primary/50 focus:outline-none"
                    />
                  </td>
                  <td className="px-4 py-3 text-center font-mono">
                    {confInfo && isMapped ? (
                      <span
                        className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary"
                        title={confInfo.reason}
                      >
                        {confInfo.confidence}% ({confInfo.detectionMethod.replace("_MATCH", "")})
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isMapped ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                        <CheckCircle2 className="size-3" /> Mapped
                      </span>
                    ) : field.required ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-600">
                        Missing
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        Optional
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold transition hover:bg-accent sm:w-auto"
        >
          <ArrowLeft className="size-4" /> Back to Upload
        </button>

        <button
          type="button"
          onClick={onNext}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-2.5 font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 sm:w-auto"
        >
          <span>Next: Run Pipeline Processing</span>
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
