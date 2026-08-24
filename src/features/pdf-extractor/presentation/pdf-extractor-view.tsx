"use client";

import React, { useState } from "react";
import { FileSpreadsheet, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { PdfDropzone } from "./pdf-dropzone";
import { ExtractionSummaryCards } from "./extraction-summary-cards";
import { CopyExportToolbar } from "./copy-export-toolbar";
import { ExtractedInvoicesTable } from "./extracted-invoices-table";
import type { PdfExtractionBatchResult } from "@/features/pdf-extractor/domain/types";
import { extractPdfInvoicesAction } from "@/features/pdf-extractor/actions/pdf-extractor.actions";

interface PdfExtractorViewProps {
  initialGstin?: string;
}

export function PdfExtractorView({ initialGstin = "" }: PdfExtractorViewProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [supplierGstin] = useState(initialGstin);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<PdfExtractionBatchResult | null>(null);

  const handleExtract = async () => {
    if (files.length === 0) {
      toast.error("Please select at least one PDF invoice.");
      return;
    }

    try {
      setIsProcessing(true);
      const formData = new FormData();
      if (supplierGstin) {
        formData.append("supplierGstin", supplierGstin);
      }
      for (const file of files) {
        formData.append("files", file);
      }

      const res = await extractPdfInvoicesAction(formData);

      if (res.success && res.data) {
        setResult(res.data);
        toast.success(`Extracted ${res.data.totalInvoicesCount} invoices successfully!`, {
          description: `${res.data.b2bCount} B2B and ${res.data.b2cCount} B2C invoices classified.`,
        });
      } else {
        toast.error(res.error || "Failed to extract PDF invoices.");
      }
    } catch {
      toast.error("An unexpected error occurred during extraction.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setFiles([]);
    setResult(null);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-gradient-to-r from-indigo-900/10 via-slate-900/5 to-transparent p-6 shadow-sm md:flex-row md:items-center md:justify-between dark:border-slate-800 dark:from-indigo-950/40">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              PDF Invoice Extractor & Classifier
            </h1>
            <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              Standalone
            </span>
          </div>
          <p className="mt-1.5 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            Upload offline client PDF invoices, shipping receipts, or D2C store bills. We extract
            all GST parameters, classify into B2B & B2C, and provide 1-click clipboard copy ready
            for GSTR-1 Excel templates.
          </p>
        </div>

        {result && (
          <button
            onClick={handleReset}
            className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700/80"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Upload New Batch</span>
          </button>
        )}
      </div>

      {/* Upload Phase or Results View */}
      {!result ? (
        <div className="space-y-6">
          <PdfDropzone
            files={files}
            onFilesChange={setFiles}
            isProcessing={isProcessing}
            onExtract={handleExtract}
          />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Stats */}
          <ExtractionSummaryCards data={result} />

          {/* Copy & Export Toolbar */}
          <CopyExportToolbar data={result} />

          {/* Interactive Invoices & HSN Table */}
          <ExtractedInvoicesTable data={result} />
        </div>
      )}
    </div>
  );
}
