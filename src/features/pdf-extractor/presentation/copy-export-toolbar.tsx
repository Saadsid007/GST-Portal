"use client";

import React, { useState } from "react";
import { Copy, Check, Download, Layers, ListOrdered } from "lucide-react";
import { toast } from "sonner";
import type { PdfExtractionBatchResult } from "@/features/pdf-extractor/domain/types";
import { downloadExtractedExcelAction } from "@/features/pdf-extractor/actions/pdf-extractor.actions";

interface CopyExportToolbarProps {
  data: PdfExtractionBatchResult;
}

export function CopyExportToolbar({ data }: CopyExportToolbarProps) {
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleCopy = async (text: string, label: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      toast.success(`${label} copied to clipboard!`, {
        description: "Ready to paste directly into your Excel or Google Sheets.",
      });
      setTimeout(() => setCopiedType(null), 2500);
    } catch {
      toast.error("Failed to copy to clipboard.");
    }
  };

  const handleDownloadExcel = async () => {
    try {
      setIsExporting(true);
      const res = await downloadExtractedExcelAction(data.invoices);
      if (res.success && res.base64 && res.fileName) {
        const byteCharacters = atob(res.base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = res.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.success("Excel file downloaded successfully!");
      } else {
        toast.error(res.error || "Failed to download Excel file.");
      }
    } catch {
      toast.error("Failed to export Excel file.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
        <Layers className="h-4 w-4 text-indigo-500" />
        <span>GSTR-1 Ready Clipboard & Export Tools:</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Copy Line Items */}
        <button
          onClick={() =>
            handleCopy(data.formattedGstr1LineItemsTsv, "All Invoice Line Items", "lines")
          }
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:border-amber-300 dark:hover:border-amber-700 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all cursor-pointer"
        >
          {copiedType === "lines" ? (
            <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <ListOrdered className="h-3.5 w-3.5 text-slate-500" />
          )}
          <span>Copy All Line Items ({data.allLineItems.length})</span>
        </button>

        {/* Copy B2B */}
        <button
          onClick={() =>
            handleCopy(data.formattedGstr1B2bTsv, "GSTR-1 B2B Table", "b2b")
          }
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:border-indigo-300 dark:hover:border-indigo-700 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all cursor-pointer"
        >
          {copiedType === "b2b" ? (
            <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Copy className="h-3.5 w-3.5 text-slate-500" />
          )}
          <span>Copy B2B ({data.b2bCount})</span>
        </button>

        {/* Copy B2CS */}
        <button
          onClick={() =>
            handleCopy(data.formattedGstr1B2csTsv, "GSTR-1 B2CS Table", "b2cs")
          }
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:border-blue-300 dark:hover:border-blue-700 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all cursor-pointer"
        >
          {copiedType === "b2cs" ? (
            <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Copy className="h-3.5 w-3.5 text-slate-500" />
          )}
          <span>Copy B2CS Table</span>
        </button>

        {/* Copy B2B HSN */}
        <button
          onClick={() =>
            handleCopy(data.formattedGstr1B2bHsnTsv, "B2B HSN Table", "b2bhsn")
          }
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:border-purple-300 dark:hover:border-purple-700 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all cursor-pointer"
        >
          {copiedType === "b2bhsn" ? (
            <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Copy className="h-3.5 w-3.5 text-slate-500" />
          )}
          <span>Copy B2B HSN ({data.b2bHsnSummary.length})</span>
        </button>

        {/* Copy All HSN */}
        <button
          onClick={() =>
            handleCopy(data.formattedGstr1HsnTsv, "GSTR-1 All HSN Table", "allhsn")
          }
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:border-purple-300 dark:hover:border-purple-700 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all cursor-pointer"
        >
          {copiedType === "allhsn" ? (
            <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Copy className="h-3.5 w-3.5 text-slate-500" />
          )}
          <span>Copy All HSN ({data.hsnSummary.length})</span>
        </button>

        {/* Download Excel */}
        <button
          onClick={handleDownloadExcel}
          disabled={isExporting}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all disabled:opacity-50 cursor-pointer"
        >
          {isExporting ? (
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          <span>Download Excel (.xlsx)</span>
        </button>
      </div>
    </div>
  );
}
