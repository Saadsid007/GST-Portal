import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/features/auth";
import prisma from "@/lib/prisma";
import { formatCurrency, formatPeriod } from "@/lib/utils";
import { Zap, History, Building2, FileSpreadsheet, ArrowRight, Plus } from "lucide-react";
import { Button } from "@/components/ui";

export const metadata: Metadata = { title: "Dashboard — Multi-Marketplace GSTR-1" };

/** The three workspace readings that actually matter day to day. */
function StatCard({
  label,
  icon: Icon,
  tone,
  value,
  unit,
  footnote,
  linkHref,
  linkLabel,
}: {
  label: string;
  icon: typeof Building2;
  tone: string;
  value: string | number;
  unit?: string;
  footnote?: string;
  linkHref: string;
  linkLabel: string;
}) {
  return (
    <div className="flex card-lift flex-col rounded-xl border border-border/80 bg-card p-4 hover:border-primary/40 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-3xs font-bold tracking-wider text-muted-foreground uppercase">
          {label}
        </span>
        <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${tone}`}>
          <Icon className="size-3.5" aria-hidden />
        </span>
      </div>

      <p className="mt-2.5 text-2xl font-bold tracking-tight text-foreground tabular-nums sm:text-3xl">
        {value}
        {unit && (
          <span className="ml-1 text-xs font-medium tracking-normal text-muted-foreground sm:text-sm">
            {unit}
          </span>
        )}
      </p>
      {footnote && (
        <p className="mt-1 truncate font-mono text-3xs text-muted-foreground">{footnote}</p>
      )}

      <div className="mt-4 flex items-center justify-end border-t border-border/60 pt-2.5 text-3xs">
        <Link
          href={linkHref}
          className="shrink-0 font-semibold text-primary-ink transition-colors hover:underline"
        >
          {linkLabel} &rarr;
        </Link>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await requireSession();
  const userId = session.user.id;

  const [recent, total, profiles] = await Promise.all([
    prisma.conversionHistory.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.conversionHistory.count({ where: { userId } }),
    prisma.gstinProfile.findMany({ where: { userId } }),
  ]);

  return (
    <div className="space-y-4">
      {/* Top Workspace Header */}
      <div className="flex flex-col justify-between gap-3 border-b border-border/70 pb-3.5 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold tracking-tight text-foreground sm:text-lg">
              Overview
            </h1>
            <span className="py-0.2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 font-mono text-3xs font-semibold text-emerald-600 dark:text-emerald-400">
              30-Day Free Trial (7 GSTINs)
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Multi-marketplace GSTR-1 automation, reconciliation & returns pipeline.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="h-8 text-xs">
            <Link href="/profile">
              <Building2 className="mr-1 size-3.5" />
              <span>GST Profiles</span>
            </Link>
          </Button>

          <Button asChild variant="brand" size="sm" className="h-8 text-xs shadow-xs">
            <Link href="/convert">
              <Zap className="mr-1 size-3.5" />
              <span>Convert Reports</span>
              <ArrowRight className="ml-1 size-3" />
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Cards — one generous reading per card, matching the marketing
          ledger treatment: label up top, oversized figure, linked footer. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="GST Profiles"
          icon={Building2}
          tone="bg-primary/10 text-primary-ink"
          value={profiles.length}
          unit="/ 7 active"
          footnote={profiles[0]?.gstinNumber ?? "No profiles added yet"}
          linkHref="/profile"
          linkLabel="Manage"
        />

        <StatCard
          label="Past Filings"
          icon={History}
          tone="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          value={total}
          unit="Returns"
          footnote="GSTN JSON & Excel generated"
          linkHref="/history"
          linkLabel="History"
        />

        <StatCard
          label="Channels"
          icon={FileSpreadsheet}
          tone="bg-amber-500/10 text-amber-600 dark:text-amber-400"
          value={10}
          unit="Platforms"
          footnote="Amazon · Meesho · Flipkart · Myntra +6"
          linkHref="/convert"
          linkLabel="Launch"
        />
      </div>

      {/* Recent Returns Log */}
      <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-xs">
        <div className="flex items-center justify-between border-b border-border/70 bg-subtle/50 px-4 py-2.5">
          <h2 className="text-xs font-bold text-foreground">Recent GSTR-1 Generations</h2>
          <Link href="/history" className="text-3xs font-semibold text-primary-ink hover:underline">
            View All History &rarr;
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="space-y-2 p-6 text-center sm:p-8">
            <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileSpreadsheet className="size-5" />
            </div>
            <p className="text-xs font-bold text-foreground">No returns generated yet</p>
            <p className="mx-auto max-w-sm text-3xs text-muted-foreground">
              Upload your Amazon MTR, Meesho GST or Flipkart report to generate your first
              government-ready GSTR-1 JSON & Excel.
            </p>
            <div className="pt-2">
              <Button asChild variant="brand" size="sm" className="h-7 text-3xs shadow-xs">
                <Link href="/convert">
                  <Plus className="mr-1 size-3" />
                  <span>Start New Conversion</span>
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[580px] text-left text-xs">
              <thead className="border-b border-border bg-subtle/70 text-3xs font-semibold tracking-wider text-muted-foreground uppercase">
                <tr>
                  <th className="px-3.5 py-2.5">Platform</th>
                  <th className="px-3.5 py-2.5">GSTIN</th>
                  <th className="px-3.5 py-2.5">Period</th>
                  <th className="px-3.5 py-2.5 text-right">Invoices</th>
                  <th className="px-3.5 py-2.5 text-right">Net Taxable</th>
                  <th className="px-3.5 py-2.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 bg-card">
                {recent.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-3.5 py-2.5">
                      <span className="rounded bg-primary/[0.08] px-1.5 py-0.5 text-3xs font-semibold text-primary-ink capitalize">
                        {item.platformId}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 font-mono text-3xs text-muted-foreground">
                      {item.gstinNumber}
                    </td>
                    <td className="px-3.5 py-2.5 text-3xs font-medium text-muted-foreground">
                      {formatPeriod(item.returnPeriod)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-3xs tabular-nums">
                      {item.totalInvoices}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-3xs font-bold text-foreground tabular-nums">
                      {formatCurrency(Number(item.totalTaxable))}
                    </td>
                    <td className="px-3.5 py-2.5 text-right">
                      <span className="py-0.2 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 text-3xs font-semibold text-emerald-600 dark:text-emerald-400">
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
