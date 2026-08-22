import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/features/auth";
import { getWalletSummary } from "@/features/billing/services/entitlement.service";
import { WalletCard } from "@/features/billing/presentation/wallet-card";
import prisma from "@/lib/prisma";
import { formatCurrency, formatPeriod } from "@/lib/utils";
import { Zap, History, Building2, FileSpreadsheet, ArrowRight, Plus } from "lucide-react";

export const metadata: Metadata = { title: "Dashboard — Multi-Marketplace GSTR-1" };

export default async function DashboardPage() {
  const session = await requireSession();
  const userId = session.user.id;

  // These four reads are independent; awaiting them in sequence cost four
  // round-trips on every dashboard load.
  const [recent, total, profiles, wallet] = await Promise.all([
    prisma.conversionHistory.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.conversionHistory.count({ where: { userId } }),
    prisma.gstinProfile.findMany({ where: { userId } }),
    getWalletSummary(userId),
  ]);

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="relative flex flex-col justify-between gap-4 overflow-hidden rounded-xl border border-border bg-gradient-to-br from-card via-card to-primary/10 p-4 sm:p-5 shadow-xs md:flex-row md:items-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 grid-lines [mask-image:linear-gradient(to_bottom_right,transparent_40%,black)] opacity-50"
        />
        <div className="relative max-w-lg space-y-1">
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-3xs font-bold tracking-wider text-primary-ink uppercase">
            Marketplace → GSTR-1 Engine
          </span>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">Multi-Marketplace GSTR-1 Generator</h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Combine reports from Amazon, Flipkart, Meesho, Myntra & more into one
            government-compatible GSTR-1 return.
          </p>
        </div>

        <Link
          href="/convert"
          className="group relative flex flex-shrink-0 items-center justify-center gap-2 rounded-xl brand-gradient px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-xs transition hover:brightness-110 active:scale-[0.98]"
        >
          <Zap className="size-4 transition-transform group-hover:scale-110" />
          <span>Generate Combined Return</span>
        </Link>
      </div>

      {/* Quick Launch Card */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <WalletCard summary={wallet} />

        <div className="card-lift space-y-1.5 rounded-xl border border-border bg-card p-4 hover:border-primary/40">
          <div className="flex items-center gap-1.5 text-3xs font-semibold text-muted-foreground uppercase">
            <Building2 className="size-3.5 text-primary-ink" /> Active GST Profiles
          </div>
          <p className="text-xl font-bold text-foreground">{profiles.length}</p>
          <p className="text-3xs text-muted-foreground truncate">
            {profiles[0] ? `Default: ${profiles[0].gstinNumber}` : "No GST profile added yet"}
          </p>
          <Link
            href="/profile"
            className="inline-flex items-center gap-1 pt-1 text-2xs font-semibold text-primary-ink hover:underline"
          >
            Manage profiles <ArrowRight className="size-3" />
          </Link>
        </div>

        <div className="card-lift space-y-1.5 rounded-xl border border-border bg-card p-4 hover:border-primary/40">
          <div className="flex items-center gap-1.5 text-3xs font-semibold text-muted-foreground uppercase">
            <History className="size-3.5 text-success" /> Past Filings
          </div>
          <p className="text-xl font-bold text-foreground">{total}</p>
          <p className="text-3xs text-muted-foreground">Processed returns & GSTR-1 history</p>
          <Link
            href="/history"
            className="inline-flex items-center gap-1 pt-1 text-2xs font-semibold text-success hover:underline"
          >
            View filing history <ArrowRight className="size-3" />
          </Link>
        </div>

        <div className="card-lift space-y-1.5 rounded-xl border border-border bg-card p-4 hover:border-primary/40">
          <div className="flex items-center gap-1.5 text-3xs font-semibold text-muted-foreground uppercase">
            <FileSpreadsheet className="size-3.5 text-primary-ink" /> Supported Marketplaces
          </div>
          <p className="text-xl font-bold text-foreground">10 Marketplaces</p>
          <p className="text-3xs text-muted-foreground truncate">
            Amazon, Flipkart, Meesho, JioMart + Custom
          </p>
          <Link
            href="/convert"
            className="inline-flex items-center gap-1 pt-1 text-2xs font-semibold text-primary-ink hover:underline"
          >
            Start new return <ArrowRight className="size-3" />
          </Link>
        </div>
      </div>

      {/* Recent Returns Log */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold">Recent Multi-Marketplace Returns</h2>
          <Link href="/history" className="text-xs font-semibold text-primary-ink hover:underline">
            View all
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="space-y-3 rounded-xl border border-dashed border-border p-10 text-center">
            <FileSpreadsheet className="mx-auto size-10 text-muted-foreground" />
            <p className="text-sm font-medium">No returns generated yet</p>
            <p className="text-xs text-muted-foreground">
              Select your return period and marketplaces to produce your first combined GSTR-1
              return.
            </p>
            <Link
              href="/convert"
              className="mt-2 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
            >
              <Plus className="size-4" /> Generate GSTR-1 Return
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
                  <th className="px-4 py-3 text-left">Platforms</th>
                  <th className="px-4 py-3 text-left">GSTIN</th>
                  <th className="px-4 py-3 text-left">Period</th>
                  <th className="px-4 py-3 text-right">Invoices</th>
                  <th className="px-4 py-3 text-right">Net Taxable</th>
                  <th className="px-4 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-border transition last:border-0 hover:bg-accent/40"
                  >
                    <td className="px-4 py-3 font-bold">{item.platformId}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {item.gstinNumber}
                    </td>
                    <td className="px-4 py-3 font-medium text-muted-foreground">
                      {formatPeriod(item.returnPeriod)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{item.totalInvoices}</td>
                    <td className="px-4 py-3 text-right font-bold text-primary-ink">
                      {formatCurrency(Number(item.totalTaxable))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
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
