import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/features/auth";
import prisma from "@/lib/prisma";
import { formatCurrency, formatPeriod } from "@/lib/utils";
import {
  Zap,
  History,
  Building2,
  FileSpreadsheet,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  FileCheck2,
  Sparkles,
  Plus,
  ArrowUpRight,
  CheckCircle2,
  FileText,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui";
import { getGstinCapacity } from "@/features/billing/services/capacity.service";
import { getOrCreateSubscription } from "@/features/billing/services/subscription.service";
import { GstinStatus } from "@/features/billing/domain/gstin-capacity";
import { currentFilingWindow } from "@/features/dashboard/domain/filing-calendar";
import { DashboardAnalyticsCharts } from "@/features/dashboard/presentation/dashboard-analytics-charts-lazy";

export const metadata: Metadata = {
  title: "Executive Dashboard — Multi-Marketplace GSTR-1",
};

interface MetricCardProps {
  label: string;
  icon: typeof Building2;
  accentColor: "blue" | "emerald" | "purple" | "amber";
  value: string;
  unit?: string;
  badgeText: string;
  badgePositive?: boolean;
  footnote: string;
  linkHref: string;
  linkLabel: string;
}

function HighlightMetricCard({
  label,
  icon: Icon,
  accentColor,
  value,
  unit,
  badgeText,
  badgePositive = true,
  footnote,
  linkHref,
  linkLabel,
}: MetricCardProps) {
  const styles = {
    blue: {
      bg: "bg-gradient-to-br from-blue-500/[0.12] via-indigo-500/[0.04] to-card border-blue-500/30 dark:from-blue-950/60 dark:via-indigo-950/30 dark:to-card/90",
      borderHover: "hover:border-blue-500/60 hover:shadow-lg hover:shadow-blue-500/10",
      iconBg:
        "bg-blue-500/15 text-blue-600 dark:bg-blue-500/25 dark:text-blue-400 ring-1 ring-blue-500/30",
      topGlow: "from-blue-500/35 via-indigo-500/20 to-transparent",
      badge: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
    },
    emerald: {
      bg: "bg-gradient-to-br from-emerald-500/[0.12] via-teal-500/[0.04] to-card border-emerald-500/30 dark:from-emerald-950/60 dark:via-teal-950/30 dark:to-card/90",
      borderHover: "hover:border-emerald-500/60 hover:shadow-lg hover:shadow-emerald-500/10",
      iconBg:
        "bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/25 dark:text-emerald-400 ring-1 ring-emerald-500/30",
      topGlow: "from-emerald-500/35 via-teal-500/20 to-transparent",
      badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    },
    purple: {
      bg: "bg-gradient-to-br from-purple-500/[0.12] via-violet-500/[0.04] to-card border-purple-500/30 dark:from-purple-950/60 dark:via-violet-950/30 dark:to-card/90",
      borderHover: "hover:border-purple-500/60 hover:shadow-lg hover:shadow-purple-500/10",
      iconBg:
        "bg-purple-500/15 text-purple-600 dark:bg-purple-500/25 dark:text-purple-400 ring-1 ring-purple-500/30",
      topGlow: "from-purple-500/35 via-violet-500/20 to-transparent",
      badge: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
    },
    amber: {
      bg: "bg-gradient-to-br from-amber-500/[0.12] via-orange-500/[0.04] to-card border-amber-500/30 dark:from-amber-950/60 dark:via-orange-950/30 dark:to-card/90",
      borderHover: "hover:border-amber-500/60 hover:shadow-lg hover:shadow-amber-500/10",
      iconBg:
        "bg-amber-500/15 text-amber-600 dark:bg-amber-500/25 dark:text-amber-400 ring-1 ring-amber-500/30",
      topGlow: "from-amber-500/35 via-orange-500/20 to-transparent",
      badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    },
  }[accentColor];

  return (
    <div
      className={`group relative flex card-lift flex-col overflow-hidden rounded-2xl border p-4.5 transition-all sm:p-5 ${styles.bg} ${styles.borderHover} shadow-xs`}
    >
      {/* Subtle top ambient light glow line */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${styles.topGlow}`}
      />

      {/* Top Header: Label & Icon */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
          {label}
        </span>
        <span
          className={`flex size-8 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110 ${styles.iconBg}`}
        >
          <Icon className="size-4" aria-hidden />
        </span>
      </div>

      {/* Main Metric Value */}
      <div className="mt-3">
        <p className="text-2xl font-black tracking-tight text-foreground tabular-nums sm:text-3xl">
          {value}
          {unit && (
            <span className="ml-1.5 text-xs font-semibold tracking-normal text-muted-foreground sm:text-sm">
              {unit}
            </span>
          )}
        </p>
      </div>

      {/* Dynamic Trend Badge & Context Footnote */}
      <div className="mt-2.5 flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-tight ${styles.badge}`}
        >
          {badgePositive && <TrendingUp className="size-2.5" />}
          {badgeText}
        </span>
      </div>

      <p className="mt-1.5 truncate text-2xs font-medium text-muted-foreground">{footnote}</p>

      {/* Action Footer */}
      <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-2.5 text-2xs">
        <span className="text-[11px] font-medium text-muted-foreground/75">Pipeline Status</span>
        <Link
          href={linkHref}
          className="inline-flex items-center gap-1 font-bold text-primary-ink transition-colors hover:underline"
        >
          <span>{linkLabel}</span>
          <ArrowRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await requireSession();
  const userId = session.user.id;

  const [recent, totalReturns, capacity, subscription, primary, aggregates, rawHistory] =
    await Promise.all([
      prisma.conversionHistory.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      prisma.conversionHistory.count({ where: { userId } }),
      getGstinCapacity(userId),
      getOrCreateSubscription(userId),
      prisma.gstinProfile.findFirst({
        where: { userId, status: GstinStatus.ACTIVE },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        select: { gstinNumber: true, tradeName: true, legalName: true },
      }),
      prisma.conversionHistory.aggregate({
        where: { userId },
        _sum: {
          totalTaxable: true,
          totalTax: true,
          totalInvoices: true,
        },
      }),
      prisma.conversionHistory.findMany({
        where: { userId },
        select: {
          platformId: true,
          returnPeriod: true,
          totalTaxable: true,
          totalTax: true,
          totalInvoices: true,
          createdAt: true,
        },
        // The latest 60. Ascending + take returned the oldest, and the charts
        // froze once an account passed 60 conversions.
        orderBy: { createdAt: "desc" },
        take: 60,
      }),
    ]);

  const hasRealData = totalReturns > 0;
  const realTaxable = Number(aggregates._sum.totalTaxable ?? 0);
  const realTax = Number(aggregates._sum.totalTax ?? 0);
  const realInvoices = aggregates._sum.totalInvoices ?? 0;

  // Process monthly data for charts if available
  const monthlyMap: Record<
    string,
    { period: string; monthName: string; taxable: number; tax: number; invoices: number }
  > = {};

  if (hasRealData) {
    rawHistory.forEach((item) => {
      const period = item.returnPeriod || "Current";
      if (!monthlyMap[period]) {
        monthlyMap[period] = {
          period,
          monthName: formatPeriod(period),
          taxable: 0,
          tax: 0,
          invoices: 0,
        };
      }
      monthlyMap[period].taxable += Number(item.totalTaxable || 0);
      monthlyMap[period].tax += Number(item.totalTax || 0);
      monthlyMap[period].invoices += item.totalInvoices || 0;
    });
  }

  // Chronological by return period (MMYYYY), not by upload order.
  const periodKey = (period: string) =>
    /^\d{6}$/.test(period) ? period.slice(2) + period.slice(0, 2) : "999999";
  const monthlyDataPoints = Object.values(monthlyMap)
    .sort((x, y) => periodKey(x.period).localeCompare(periodKey(y.period)))
    .slice(-6);

  // Platform share distribution
  const platformCounts: Record<string, { name: string; count: number; invoices: number }> = {};
  if (hasRealData) {
    rawHistory.forEach((item) => {
      const p = item.platformId.toLowerCase();
      const displayName = p.includes("amazon")
        ? "Amazon MTR"
        : p.includes("flipkart")
          ? "Flipkart GSTR"
          : p.includes("meesho")
            ? "Meesho TCS"
            : p.includes("myntra")
              ? "Myntra"
              : item.platformId.toUpperCase();

      if (!platformCounts[displayName]) {
        platformCounts[displayName] = { name: displayName, count: 0, invoices: 0 };
      }
      platformCounts[displayName].count++;
      platformCounts[displayName].invoices += item.totalInvoices || 0;
    });
  }

  const platformColors = ["#3B82F6", "#6366F1", "#10B981", "#F59E0B", "#EC4899", "#8B5CF6"];
  const platformDistribution = Object.values(platformCounts).map((item, idx) => ({
    name: item.name,
    value: item.count,
    color: platformColors[idx % platformColors.length] || "#3B82F6",
    invoices: item.invoices,
    share: `${Math.round((item.count / Math.max(rawHistory.length, 1)) * 100)}%`,
  }));

  const filing = currentFilingWindow();
  const platformNames =
    Object.keys(platformCounts)
      .join(", ")
      .replace(/, ([^,]*)$/, " & $1") || "your marketplaces";

  const planBadge = subscription.isExpired
    ? "Plan expired"
    : subscription.isTrial
      ? `Free Trial · ${subscription.daysRemaining} days left`
      : `${subscription.planName} · ${subscription.daysRemaining} days left`;

  return (
    <div className="space-y-6">
      {/* 1. Hero Executive Welcome & Live Action Strip */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-4.5 shadow-sm sm:p-6">
        {/* Soft radial backdrop illumination */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 -right-20 size-72 rounded-full bg-primary/10 blur-3xl dark:bg-primary/20"
        />

        <div className="relative z-10 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-extrabold tracking-tight text-foreground sm:text-2xl">
                Compliance Command Center
              </h1>
              <Link
                href="/billing"
                className={`rounded-full border px-2.5 py-0.5 text-2xs font-bold tracking-wide transition-all hover:scale-105 ${
                  subscription.isExpired
                    ? "border-destructive/30 bg-destructive/10 text-destructive-ink"
                    : "border-success/30 bg-success/10 text-success-ink"
                }`}
              >
                <span className="mr-1.5 inline-block size-1.5 animate-pulse rounded-full bg-emerald-500" />
                {planBadge}
              </Link>
            </div>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Automated multi-marketplace reconciliation, tax ledger verification &amp;
              government-ready GSTR-1 engine.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-9 rounded-xl text-xs font-semibold shadow-2xs"
            >
              <Link href="/profile">
                <Building2 className="mr-1.5 size-3.5 text-muted-foreground" />
                <span>GST Profiles</span>
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-9 rounded-xl text-xs font-semibold shadow-2xs"
            >
              <Link href="/pdf-extractor">
                <FileSpreadsheet className="mr-1.5 size-3.5 text-muted-foreground" />
                <span>PDF Extractor</span>
              </Link>
            </Button>

            <Button
              asChild
              size="sm"
              className="h-9 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 px-4 text-xs font-bold text-white shadow-md shadow-blue-500/25 transition-all hover:brightness-110 active:scale-[0.98]"
            >
              <Link href="/convert">
                <Zap className="mr-1.5 size-3.5 animate-pulse text-amber-300 drop-shadow-[0_0_6px_rgba(245,158,11,0.6)]" />
                <span>Convert Reports</span>
                <ArrowRight className="ml-1.5 size-3.5" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Live Filing Status Pill Banner */}
        <div className="relative z-10 mt-4 flex flex-wrap items-center gap-3 border-t border-border/60 pt-3.5 text-2xs text-muted-foreground">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <Clock className="size-3.5 text-primary" />
            <span>Active Return Period:</span>
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-3xs font-bold">
              {filing.periodLabel}
            </span>
          </div>
          <span className="hidden text-border sm:inline">•</span>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5 text-emerald-500" />
            <span>
              GSTR-1 due {filing.dueLabel} (
              {filing.daysLeft === 0
                ? "today"
                : `${filing.daysLeft} day${filing.daysLeft === 1 ? "" : "s"} left`}
              )
            </span>
          </div>
          <span className="hidden text-border sm:inline">•</span>
          <div className="flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-amber-500" />
            <span>JSON in GST Offline Tool V3.2.4 format</span>
          </div>
        </div>
      </div>

      {/* 2. Four Executive Highlight KPI Cards (Bespoke Vivid Highlight Accents) */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Electric Blue - Taxable Sales */}
        <HighlightMetricCard
          label="Taxable Turnover"
          icon={TrendingUp}
          accentColor="blue"
          value={formatCurrency(realTaxable)}
          badgeText={hasRealData ? `${totalReturns} Batches Processed` : "No returns yet"}
          badgePositive={hasRealData}
          footnote={
            hasRealData
              ? `Aggregated across ${platformNames}`
              : "Convert your first marketplace report to see it here"
          }
          linkHref="/history"
          linkLabel="Sales Log"
        />

        {/* Card 2: Mint Emerald - GST Tax Liability */}
        <HighlightMetricCard
          label="GST Tax Processed"
          icon={ShieldCheck}
          accentColor="emerald"
          value={formatCurrency(realTax)}
          badgeText={hasRealData ? "IGST + CGST + SGST" : "No returns yet"}
          badgePositive={hasRealData}
          footnote="IGST, CGST & SGST split by place of supply"
          linkHref="/history"
          linkLabel="Tax Audit"
        />

        {/* Card 3: Royal Purple - Invoices & Filings */}
        <HighlightMetricCard
          label="Invoices Parsed"
          icon={FileCheck2}
          accentColor="purple"
          value={realInvoices.toLocaleString("en-IN")}
          unit="Invoices"
          badgeText={hasRealData ? `${totalReturns} returns` : "No returns yet"}
          badgePositive={hasRealData}
          footnote={
            hasRealData
              ? `${totalReturns} GSTR-1 returns generated`
              : "Portal-ready JSON for the GST Offline Tool V3.2.4"
          }
          linkHref="/history"
          linkLabel="Returns Log"
        />

        {/* Card 4: Warm Amber - Active GSTIN Capacity */}
        <HighlightMetricCard
          label="GST Profiles"
          icon={Building2}
          accentColor="amber"
          value={`${capacity.activeProfiles} / ${capacity.totalCapacity}`}
          unit="Active"
          badgeText="Plan Capacity"
          badgePositive={true}
          footnote={
            primary
              ? `${primary.gstinNumber} · ${primary.tradeName || primary.legalName}`
              : "No GSTIN configured yet"
          }
          linkHref="/profile"
          linkLabel="Manage GSTINs"
        />
      </div>

      {/* 3. Interactive Visual Analytics & Distribution Charts */}
      <DashboardAnalyticsCharts
        monthlyData={monthlyDataPoints}
        platformDistribution={platformDistribution}
        hasRealData={hasRealData}
      />

      {/* 4. Supported Marketplace Automation Pipeline Grid */}
      <div className="rounded-2xl border border-border/80 bg-card p-4.5 shadow-xs">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div>
            <h2 className="text-sm font-bold tracking-tight text-foreground">
              Marketplace Automation Channels
            </h2>
            <p className="text-2xs text-muted-foreground">
              Instant AI report ingestion, tax breakdown &amp; HSN classification
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="h-7 rounded-lg text-2xs">
            <Link href="/convert">
              <span>View All Supported</span>
              <ArrowUpRight className="ml-1 size-3" />
            </Link>
          </Button>
        </div>

        <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Channel 1: Amazon */}
          <div className="flex flex-col justify-between rounded-xl border border-border/70 bg-muted/20 p-3.5 transition-all hover:border-blue-500/40 hover:bg-muted/40">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Amazon MTR</span>
                <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[9px] font-bold text-blue-600 dark:text-blue-400">
                  V3.2.4 ready
                </span>
              </div>
              <p className="mt-1 text-2xs text-muted-foreground">
                Merchant Tax Report, B2B, B2C, Seller Flex &amp; AFN
              </p>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2 font-mono text-3xs text-muted-foreground">
              <span>.csv / .xlsx</span>
              <Link href="/convert" className="font-bold text-primary-ink hover:underline">
                Convert &rarr;
              </Link>
            </div>
          </div>

          {/* Channel 2: Flipkart */}
          <div className="flex flex-col justify-between rounded-xl border border-border/70 bg-muted/20 p-3.5 transition-all hover:border-indigo-500/40 hover:bg-muted/40">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Flipkart GSTR</span>
                <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[9px] font-bold text-indigo-600 dark:text-indigo-400">
                  V3.2.4 ready
                </span>
              </div>
              <p className="mt-1 text-2xs text-muted-foreground">
                GSTR-1 Sales Report, TCS section 7(B)(2) &amp; Table 14
              </p>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2 font-mono text-3xs text-muted-foreground">
              <span>.xlsx multi-sheet</span>
              <Link href="/convert" className="font-bold text-primary-ink hover:underline">
                Convert &rarr;
              </Link>
            </div>
          </div>

          {/* Channel 3: Meesho */}
          <div className="flex flex-col justify-between rounded-xl border border-border/70 bg-muted/20 p-3.5 transition-all hover:border-emerald-500/40 hover:bg-muted/40">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Meesho TCS</span>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                  V3.2.4 ready
                </span>
              </div>
              <p className="mt-1 text-2xs text-muted-foreground">
                TCS Sales, Returns, Zero Return &amp; POS Validation
              </p>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2 font-mono text-3xs text-muted-foreground">
              <span>.xlsx / .csv</span>
              <Link href="/convert" className="font-bold text-primary-ink hover:underline">
                Convert &rarr;
              </Link>
            </div>
          </div>

          {/* Channel 4: Myntra & Quick Commerce */}
          <div className="flex flex-col justify-between rounded-xl border border-border/70 bg-muted/20 p-3.5 transition-all hover:border-amber-500/40 hover:bg-muted/40">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Myntra &amp; more</span>
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400">
                  Ready
                </span>
              </div>
              <p className="mt-1 text-2xs text-muted-foreground">
                Myntra, JioMart, Snapdeal, GlowRoad &amp; ShopDeck reports
              </p>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2 font-mono text-3xs text-muted-foreground">
              <span>.xlsx / .csv</span>
              <Link href="/convert" className="font-bold text-primary-ink hover:underline">
                Convert &rarr;
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Recent GSTR-1 Generations & Output Archive */}
      <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xs">
        <div className="flex items-center justify-between border-b border-border/70 bg-subtle/40 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <History className="size-3.5" />
            </span>
            <h2 className="text-xs font-bold text-foreground">Recent GSTR-1 Returns Generated</h2>
          </div>
          <Link href="/history" className="text-3xs font-bold text-primary-ink hover:underline">
            View Complete History &rarr;
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="space-y-3 p-8 text-center sm:p-12">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs">
              <FileSpreadsheet className="size-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">No returns generated yet</p>
              <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
                Upload your Amazon MTR, Meesho GST or Flipkart settlement report to generate your
                first official GSTR-1 JSON &amp; verified Excel workbook.
              </p>
            </div>
            <div className="pt-2">
              <Button
                asChild
                size="sm"
                className="h-8 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 px-4 text-xs font-bold text-white shadow-md shadow-blue-500/25 hover:brightness-110"
              >
                <Link href="/convert">
                  <Plus className="mr-1.5 size-3.5" />
                  <span>Start New Conversion</span>
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead className="border-b border-blue-500/20 bg-gradient-to-r from-blue-900/[0.08] via-indigo-900/[0.05] to-blue-900/[0.08] text-xs font-bold tracking-wider text-blue-950 uppercase dark:from-blue-950/70 dark:via-slate-900/60 dark:to-indigo-950/70 dark:text-blue-100">
                <tr>
                  <th className="px-4.5 py-3.5">Channel</th>
                  <th className="px-4.5 py-3.5">GSTIN</th>
                  <th className="px-4.5 py-3.5">Return Period</th>
                  <th className="px-4.5 py-3.5 text-right">Invoices</th>
                  <th className="px-4.5 py-3.5 text-right">Taxable Sales</th>
                  <th className="px-4.5 py-3.5 text-right">GST Tax</th>
                  <th className="px-4.5 py-3.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 bg-card">
                {recent.map((item) => (
                  <tr
                    key={item.id}
                    className="transition-colors hover:bg-blue-500/[0.03] dark:hover:bg-blue-400/[0.05]"
                  >
                    <td className="px-4.5 py-3.5 font-semibold text-foreground">
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/20 bg-blue-500/[0.12] px-2.5 py-1 text-xs font-bold text-blue-700 capitalize dark:bg-blue-500/20 dark:text-blue-300">
                        <FileText className="size-3.5" />
                        {item.platformId}
                      </span>
                    </td>
                    <td className="px-4.5 py-3.5 font-mono text-[13px] text-muted-foreground">
                      {item.gstinNumber}
                    </td>
                    <td className="px-4.5 py-3.5 text-[13.5px] font-medium text-foreground">
                      {formatPeriod(item.returnPeriod)}
                    </td>
                    <td className="px-4.5 py-3.5 text-right font-mono text-[13.5px] font-semibold tabular-nums">
                      {item.totalInvoices.toLocaleString("en-IN")}
                    </td>
                    <td className="px-4.5 py-3.5 text-right font-mono text-[14.5px] font-black text-foreground tabular-nums">
                      {formatCurrency(Number(item.totalTaxable))}
                    </td>
                    <td className="px-4.5 py-3.5 text-right font-mono text-[13.5px] font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
                      {formatCurrency(Number(item.totalTax))}
                    </td>
                    <td className="px-4.5 py-3.5 text-right">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
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
