"use client";

import React from "react";
import { FileCheck, Receipt, ArrowUpRight, CheckCircle2 } from "lucide-react";
import type { PdfExtractionBatchResult } from "@/features/pdf-extractor/domain/types";

interface ExtractionSummaryCardsProps {
  data: PdfExtractionBatchResult;
}

export function ExtractionSummaryCards({ data }: ExtractionSummaryCardsProps) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val);
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. Total Invoices & Split */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Total Invoices
          </span>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
            <FileCheck className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-foreground">{data.totalInvoicesCount}</span>
          <span className="text-xs text-muted-foreground">Processed</span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200/60 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/60 dark:text-emerald-300">
            B2B: {data.b2bCount}
          </span>
          <span className="inline-flex items-center gap-1 rounded-md border border-blue-200/60 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:border-blue-800/60 dark:bg-blue-950/60 dark:text-blue-300">
            B2C: {data.b2cCount}
          </span>
        </div>
      </div>

      {/* 2. Total Taxable Value */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Total Taxable Value
          </span>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
            <Receipt className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2">
          <span className="text-2xl font-bold text-foreground">
            {formatCurrency(data.totalTaxableValue)}
          </span>
        </div>
        <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          <span>Before GST calculations</span>
        </div>
      </div>

      {/* 3. Tax Breakdown */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            GST Tax Breakdown
          </span>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
            <ArrowUpRight className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2">
          <span className="text-2xl font-bold text-foreground">
            {formatCurrency(
              data.totalIgstAmount +
                data.totalCgstAmount +
                data.totalSgstAmount +
                data.totalCessAmount
            )}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-[11px] text-muted-foreground">
          <span>IGST: {formatCurrency(data.totalIgstAmount)}</span>
          <span>C+S: {formatCurrency(data.totalCgstAmount + data.totalSgstAmount)}</span>
        </div>
      </div>

      {/* 4. Total Gross Amount */}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-indigo-500/5 via-indigo-500/10 to-transparent p-5 shadow-sm dark:from-indigo-950/40">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wider text-indigo-600 uppercase dark:text-indigo-400">
            Gross Invoice Value
          </span>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
            <Receipt className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2">
          <span className="text-2xl font-bold text-indigo-950 dark:text-indigo-100">
            {formatCurrency(data.totalGrossAmount)}
          </span>
        </div>
        <div className="mt-3 text-xs font-medium text-indigo-700 dark:text-indigo-300">
          Taxable + GST All Invoices
        </div>
      </div>
    </div>
  );
}
