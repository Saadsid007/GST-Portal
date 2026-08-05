import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/features/auth";
import prisma from "@/lib/prisma";
import { formatCurrency, formatPeriod } from "@/lib/utils";
import { History, Zap, Clock, ShieldCheck } from "lucide-react";
import { HistoryDownloader } from "@/features/history/presentation/history-downloader";

export const metadata: Metadata = { title: "Filing History & Audit Log — GSTPilot" };

export default async function HistoryPage() {
  const session = await requireSession();

  const records = await prisma.conversionHistory.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Filing History & Audit Log</h1>
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
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          {/* min-w keeps the 9 columns legible and scrolling rather than crushed; the wrapper
              scrolls instead of clipping, which used to hide the Downloads column entirely. */}
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Marketplaces</th>
                <th className="px-4 py-3 text-left">GSTIN</th>
                <th className="px-4 py-3 text-left">Period</th>
                <th className="px-4 py-3 text-right">Invoices</th>
                <th className="px-4 py-3 text-right">Net Taxable</th>
                <th className="px-4 py-3 text-center">Processing Time</th>
                <th className="px-4 py-3 text-center">TCS Status</th>
                <th className="px-4 py-3 text-right">Downloads</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr
                  key={record.id}
                  className="border-b border-border transition last:border-0 hover:bg-accent/40"
                >
                  <td className="px-4 py-3 text-xs whitespace-nowrap text-muted-foreground">
                    {new Date(record.createdAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3 font-bold">{record.platformId}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {record.gstinNumber}
                  </td>
                  <td className="px-4 py-3 font-medium text-muted-foreground">
                    {formatPeriod(record.returnPeriod)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{record.totalInvoices}</td>
                  <td className="px-4 py-3 text-right font-bold text-primary-ink">
                    {formatCurrency(Number(record.totalTaxable))}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                      <Clock className="size-3" />{" "}
                      {record.processingTimeMs > 0 ? `${record.processingTimeMs}ms` : "<1s"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        record.tcsStatus === "RECONCILED"
                          ? "bg-success/10 text-success"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <ShieldCheck className="size-3" /> {record.tcsStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
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
