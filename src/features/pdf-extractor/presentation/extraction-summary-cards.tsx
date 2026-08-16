"use client";

import React from "react";
import { FileCheck, Receipt, ArrowUpRight, CheckCircle2 } from "lucide-react";
import type { PdfExtractionBatchResult } from "../domain/types";

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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Invoices & Split */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Total Invoices
          </span>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
            <FileCheck className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {data.totalInvoicesCount}
          </span>
          <span className="text-xs text-slate-500">Processed</span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
            B2B: {data.b2bCount}
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
            B2C: {data.b2cCount}
          </span>
        </div>
      </div>

      {/* 2. Total Taxable Value */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Total Taxable Value
          </span>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
            <Receipt className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2">
          <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {formatCurrency(data.totalTaxableValue)}
          </span>
        </div>
        <div className="mt-3 text-xs text-slate-500 flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          <span>Before GST calculations</span>
        </div>
      </div>

      {/* 3. Tax Breakdown */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            GST Tax Breakdown
          </span>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
            <ArrowUpRight className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2">
          <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {formatCurrency(data.totalIgstAmount + data.totalCgstAmount + data.totalSgstAmount + data.totalCessAmount)}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2">
          <span>IGST: {formatCurrency(data.totalIgstAmount)}</span>
          <span>C+S: {formatCurrency(data.totalCgstAmount + data.totalSgstAmount)}</span>
        </div>
      </div>

      {/* 4. Total Gross Amount */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-indigo-500/5 via-indigo-500/10 to-transparent dark:from-indigo-950/40 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
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
        <div className="mt-3 text-xs text-indigo-700 dark:text-indigo-300 font-medium">
          Taxable + GST All Invoices
        </div>
      </div>
    </div>
  );
}
