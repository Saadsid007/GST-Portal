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
      <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-500/[0.12] via-indigo-500/[0.04] to-card p-5 shadow-sm transition-all hover:border-blue-500/50 hover:shadow-md hover:shadow-blue-500/5 dark:from-blue-950/60 dark:via-indigo-950/30 dark:to-card/90">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
            Total Invoices
          </span>
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 ring-1 ring-blue-500/30 dark:bg-blue-500/25 dark:text-blue-400">
            <FileCheck className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            {data.totalInvoicesCount}
          </span>
          <span className="text-xs font-medium text-muted-foreground">Processed</span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
            B2B: {data.b2bCount}
          </span>
          <span className="inline-flex items-center gap-1 rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-xs font-bold text-blue-700 dark:text-blue-300">
            B2C: {data.b2cCount}
          </span>
        </div>
      </div>

      {/* 2. Total Taxable Value */}
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.12] via-teal-500/[0.04] to-card p-5 shadow-sm transition-all hover:border-emerald-500/50 hover:shadow-md hover:shadow-emerald-500/5 dark:from-emerald-950/60 dark:via-teal-950/30 dark:to-card/90">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
            Total Taxable Value
          </span>
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/30 dark:bg-emerald-500/25 dark:text-emerald-400">
            <Receipt className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2">
          <span className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            {formatCurrency(data.totalTaxableValue)}
          </span>
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          <span>Before GST calculations</span>
        </div>
      </div>

      {/* 3. Tax Breakdown */}
      <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/[0.12] via-orange-500/[0.04] to-card p-5 shadow-sm transition-all hover:border-amber-500/50 hover:shadow-md hover:shadow-amber-500/5 dark:from-amber-950/60 dark:via-orange-950/30 dark:to-card/90">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
            GST Tax Breakdown
          </span>
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 ring-1 ring-amber-500/30 dark:bg-amber-500/25 dark:text-amber-400">
            <ArrowUpRight className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2">
          <span className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            {formatCurrency(
              data.totalIgstAmount +
                data.totalCgstAmount +
                data.totalSgstAmount +
                data.totalCessAmount
            )}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-border/80 pt-2 text-xs font-medium text-muted-foreground">
          <span>IGST: {formatCurrency(data.totalIgstAmount)}</span>
          <span>C+S: {formatCurrency(data.totalCgstAmount + data.totalSgstAmount)}</span>
        </div>
      </div>

      {/* 4. Total Gross Amount */}
      <div className="rounded-2xl border border-purple-500/35 bg-gradient-to-br from-purple-500/[0.14] via-indigo-500/[0.05] to-card p-5 shadow-sm transition-all hover:border-purple-500/60 hover:shadow-md hover:shadow-purple-500/5 dark:from-purple-950/60 dark:via-indigo-950/30 dark:to-card/90">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold tracking-wider text-purple-700 uppercase dark:text-purple-300">
            Gross Invoice Value
          </span>
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-600 text-white shadow-sm ring-1 ring-purple-500/40">
            <Receipt className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2">
          <span className="text-2xl font-black tracking-tight text-purple-950 sm:text-3xl dark:text-purple-100">
            {formatCurrency(data.totalGrossAmount)}
          </span>
        </div>
        <div className="mt-3 text-xs font-semibold text-purple-700 dark:text-purple-300">
          Taxable + GST All Invoices
        </div>
      </div>
    </div>
  );
}
