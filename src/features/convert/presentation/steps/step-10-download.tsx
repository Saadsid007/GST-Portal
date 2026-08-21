"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { MultiConvertState } from "@/features/convert/presentation/convert-workbench";
import {
  generateGstr1ExcelAction,
  saveConversionAction,
} from "@/features/convert/actions/convert.actions";
import { formatCurrency } from "@/lib/utils";
import { WATERMARK_TEXT } from "@/features/billing/constants/billing.constants";
import {
  FileJson,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  RefreshCw,
  Loader2,
} from "lucide-react";

interface Props {
  state: MultiConvertState;
  onReset: () => void;
}

export function Step10Download({ state, onReset }: Props) {
  const [downloading, setDownloading] = useState(false);
  const [savingHistory, setSavingHistory] = useState(false);
  const [saved, setSaved] = useState(false);

  const statement = state.statement;
  if (!statement) return null;

  function downloadJson() {
    if (!state.gstr1Json) {
      toast.error("JSON payload is missing");
      return;
    }
    // The payload was built before the credit gate ran, so the trial notice is
    // stamped here. Unlike the workbooks there is no server round trip to hook.
    const payload = state.watermark
      ? JSON.stringify({ ...JSON.parse(state.gstr1Json), _generatedBy: WATERMARK_TEXT }, null, 2)
      : state.gstr1Json;
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `GSTR1_${state.gstinNumber}_${state.returnPeriod}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("GSTR-1 JSON downloaded!");
  }

  async function downloadExcel() {
    setDownloading(true);
    try {
      const res = await generateGstr1ExcelAction(state.rows, state.gstinNumber, state.returnPeriod);
      if (!res.success) {
        toast.error("Failed to generate Excel file");
        return;
      }
      const buffer = new Uint8Array(res.data.buffer);
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `GSTR1_${state.gstinNumber}_${state.returnPeriod}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Official GSTR-1 Excel Workbook downloaded!");
    } catch {
      toast.error("Error downloading Excel");
    } finally {
      setDownloading(false);
    }
  }

  async function handleSaveHistory() {
    if (!statement) return;
    setSavingHistory(true);
    try {
      const res = await saveConversionAction({
        gstinNumber: state.gstinNumber,
        returnPeriod: state.returnPeriod,
        platformIds: state.selectedPlatformIds,
        fileName: state.uploadedFiles.map((f) => f.fileName).join(", "),
        totalInvoices: statement.totalInvoices,
        totalTaxable: statement.netTaxable,
        totalTax: statement.netTax,
        jsonPayload: state.gstr1Json,
        normalizedData: state.rows,
      });

      if (res.success) {
        setSaved(true);
        toast.success("Conversion saved to history!");
      }
    } catch {
      toast.error("Failed to save conversion history");
    } finally {
      setSavingHistory(false);
    }
  }

  return (
    <div className="space-y-8 p-6 md:p-8">
      <div className="mx-auto max-w-lg space-y-2 text-center">
        <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-bold tracking-wider text-success uppercase">
          Step 10 of 10 — Complete
        </span>
        <div className="mx-auto mt-2 flex size-12 items-center justify-center rounded-full bg-success/10 text-success">
          <CheckCircle2 className="size-6" />
        </div>
        <h2 className="text-2xl font-bold">Download GSTR-1 Return Files</h2>
        <p className="text-sm text-muted-foreground">
          Your multi-marketplace GSTR-1 return for period{" "}
          <span className="font-mono font-bold text-foreground">{state.returnPeriod}</span> is
          ready.
        </p>
      </div>

      <div className="mx-auto grid max-w-2xl grid-cols-2 gap-4 rounded-xl border border-border bg-card p-5 text-center sm:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">GSTIN</p>
          <p className="mt-1 truncate font-mono text-xs font-bold">{state.gstinNumber}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Return Period</p>
          <p className="mt-1 font-mono text-xs font-bold">{state.returnPeriod}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Net Taxable</p>
          <p className="mt-1 text-sm font-bold text-primary-ink">
            {formatCurrency(statement.netTaxable)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Net Tax</p>
          <p className="mt-1 text-sm font-bold">{formatCurrency(statement.netTax)}</p>
        </div>
      </div>

      <div className="mx-auto grid max-w-3xl grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Card 1: Official Excel Workbook */}
        <div className="flex flex-col justify-between space-y-4 rounded-2xl border border-border bg-card p-6 text-center shadow-sm transition hover:border-success/50">
          <div className="space-y-3">
            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-success/10 text-success">
              <FileSpreadsheet className="size-6" />
            </div>
            <div>
              <h3 className="text-base font-bold">GSTR-1 Excel Workbook</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Official GSTN Offline Template v2.1 (32 sheets) with B2B, B2CS, CDNR, HSN, ECO & DOCS
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={downloadExcel}
            disabled={downloading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-success px-4 py-2.5 font-bold text-success-foreground shadow-sm transition hover:bg-success/90 disabled:opacity-50"
          >
            {downloading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Download Excel
          </button>
        </div>

        {/* Card 2: Official GSTN JSON */}
        <div className="flex flex-col justify-between space-y-4 rounded-2xl border border-border bg-card p-6 text-center shadow-sm transition hover:border-primary/50">
          <div className="space-y-3">
            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary-ink">
              <FileJson className="size-6" />
            </div>
            <div>
              <h3 className="text-base font-bold">GSTN Government JSON</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Official GSTN v3.1.6 JSON format for 1-click direct upload to the GST Portal
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={downloadJson}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            <Download className="size-4" /> Download JSON
          </button>
        </div>
      </div>

      <div className="mx-auto flex max-w-xl flex-col items-center justify-center gap-3 border-t border-border pt-4 sm:flex-row">
        <button
          type="button"
          onClick={handleSaveHistory}
          disabled={savingHistory || saved}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-bold transition hover:bg-accent disabled:opacity-50 sm:w-auto"
        >
          {savingHistory ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          {saved ? "Saved to History" : "Save Record to History"}
        </button>

        <button
          type="button"
          onClick={onReset}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 sm:w-auto"
        >
          <RefreshCw className="size-4" /> Start New Conversion
        </button>
      </div>
    </div>
  );
}
