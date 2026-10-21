import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/features/auth";
import prisma from "@/lib/prisma";
import { formatCurrency, formatPeriod } from "@/lib/utils";
import { History, Zap, Clock, ShieldCheck, FileSpreadsheet, Receipt } from "lucide-react";
import { HistoryDownloader } from "@/features/history/presentation/history-downloader";

export const metadata: Metadata = { title: "Filing History & Audit Log — GSTPilot" };

export default async function HistoryPage() {
  const session = await requireSession();

  const records = await prisma.conversionHistory.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const totalInvoicesSum = records.reduce((acc, r) => acc + (r.totalInvoices || 0), 0);
  const totalTaxableSum = records.reduce((acc, r) => acc + Number(r.totalTaxable || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Filing History &amp; Audit Log</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {records.length} past multi-marketplace return{records.length !== 1 ? "s" : ""}{" "}
            generated
          </p>
        </div>
        <Link
          href="/convert"
          className="flex flex-shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90"
        >
          <Zap className="size-4" /> New Conversion
        </Link>
      </div>

      {/* Top Attractive Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-500/[0.12] via-indigo-500/[0.04] to-card p-5 shadow-sm transition-all hover:border-blue-500/50 hover:shadow-md hover:shadow-blue-500/5 dark:from-blue-950/60 dark:via-indigo-950/30 dark:to-card/90">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              Total Filings Generated
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 ring-1 ring-blue-500/30 dark:bg-blue-500/25 dark:text-blue-400">
              <FileSpreadsheet className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            {records.length}
          </p>
          <p className="mt-1 text-xs font-medium text-muted-foreground">Audit-ready GSTR-1 files</p>
        </div>

        <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.12] via-teal-500/[0.04] to-card p-5 shadow-sm transition-all hover:border-emerald-500/50 hover:shadow-md hover:shadow-emerald-500/5 dark:from-emerald-950/60 dark:via-teal-950/30 dark:to-card/90">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              Invoices Reconciled
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/30 dark:bg-emerald-500/25 dark:text-emerald-400">
              <Zap className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            {totalInvoicesSum.toLocaleString("en-IN")}
          </p>
          <p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            Across Amazon, Flipkart, Meesho
          </p>
        </div>

        <div className="rounded-2xl border border-purple-500/35 bg-gradient-to-br from-purple-500/[0.14] via-indigo-500/[0.05] to-card p-5 shadow-sm transition-all hover:border-purple-500/60 hover:shadow-md hover:shadow-purple-500/5 dark:from-purple-950/60 dark:via-indigo-950/30 dark:to-card/90">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wider text-purple-700 uppercase dark:text-purple-300">
              Total Net Taxable Sales
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-600 text-white shadow-sm ring-1 ring-purple-500/40">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black tracking-tight text-purple-950 sm:text-3xl dark:text-purple-100">
            {formatCurrency(totalTaxableSum)}
          </p>
          <p className="mt-1 text-xs font-medium text-purple-700 dark:text-purple-300">
            100% TCS reconciled &amp; validated
          </p>
        </div>
      </div>

      {records.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center sm:p-12">
          <History className="mx-auto mb-3 size-10 text-muted-foreground" />
          <p className="text-sm font-bold">No saved returns yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Generate your first GSTR-1 return and save it to history for easy re-downloading and
            audit tracking.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-blue-500/20 bg-card shadow-sm">
          <table className="w-full min-w-[820px] text-[14px]">
            <thead>
              <tr className="border-b border-blue-500/20 bg-gradient-to-r from-blue-900/[0.08] via-indigo-900/[0.05] to-blue-900/[0.08] text-xs font-bold tracking-wider text-blue-950 uppercase dark:from-blue-950/70 dark:via-slate-900/60 dark:to-indigo-950/70 dark:text-blue-100">
                <th className="px-4.5 py-3.5 text-left">Date</th>
                <th className="px-4.5 py-3.5 text-left">Marketplaces</th>
                <th className="px-4.5 py-3.5 text-left">GSTIN</th>
                <th className="px-4.5 py-3.5 text-left">Period</th>
                <th className="px-4.5 py-3.5 text-right">Invoices</th>
                <th className="px-4.5 py-3.5 text-right">Net Taxable</th>
                <th className="px-4.5 py-3.5 text-center">Processing Time</th>
                <th className="px-4.5 py-3.5 text-center">TCS Status</th>
                <th className="px-4.5 py-3.5 text-right">Downloads</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {records.map((record) => (
                <tr
                  key={record.id}
                  className="transition-colors hover:bg-blue-500/[0.03] dark:hover:bg-blue-400/[0.05]"
                >
                  <td className="px-4.5 py-3.5 text-[13.5px] font-medium whitespace-nowrap text-muted-foreground">
                    {new Date(record.createdAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4.5 py-3.5 font-bold text-foreground">{record.platformId}</td>
                  <td className="px-4.5 py-3.5 font-mono text-[13px] text-muted-foreground">
                    {record.gstinNumber}
                  </td>
                  <td className="px-4.5 py-3.5 text-[13.5px] font-medium text-muted-foreground">
                    {formatPeriod(record.returnPeriod)}
                  </td>
                  <td className="px-4.5 py-3.5 text-right font-mono text-[13.5px] font-bold">
                    {record.totalInvoices}
                  </td>
                  <td className="px-4.5 py-3.5 text-right font-mono text-[14px] font-bold text-primary-ink">
                    {formatCurrency(Number(record.totalTaxable))}
                  </td>
                  <td className="px-4.5 py-3.5 text-center">
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                      <Clock className="size-3" />{" "}
                      {record.processingTimeMs > 0 ? `${record.processingTimeMs}ms` : "<1s"}
                    </span>
                  </td>
                  <td className="px-4.5 py-3.5 text-center">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                        record.tcsStatus === "RECONCILED"
                          ? "border border-success/30 bg-success/10 text-success"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <ShieldCheck className="size-3.5" /> {record.tcsStatus}
                    </span>
                  </td>
                  <td className="px-4.5 py-3.5 text-right">
                    <HistoryDownloader
                      record={{
                        gstinNumber: record.gstinNumber,
                        returnPeriod: record.returnPeriod,
                        jsonPayload: record.jsonPayload,
                        normalizedData: record.normalizedData,
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
