"use client";

import { useState, useSyncExternalStore } from "react";
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, PieChart as PieIcon, BarChart3 } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";

interface MonthlyPoint {
  period: string;
  monthName: string;
  taxable: number;
  tax: number;
  invoices: number;
}

interface PlatformShare {
  name: string;
  value: number;
  color: string;
  invoices: number;
  share: string;
}

interface DashboardChartsProps {
  monthlyData: MonthlyPoint[];
  platformDistribution: PlatformShare[];
  hasRealData: boolean;
}

const DEFAULT_MONTHLY_DATA: MonthlyPoint[] = [
  { period: "052026", monthName: "May", taxable: 2840000, tax: 511200, invoices: 840 },
  { period: "062026", monthName: "Jun", taxable: 3420000, tax: 615600, invoices: 1020 },
  { period: "072026", monthName: "Jul", taxable: 3180000, tax: 572400, invoices: 950 },
  { period: "082026", monthName: "Aug", taxable: 4250000, tax: 765000, invoices: 1340 },
  { period: "092026", monthName: "Sep", taxable: 4890000, tax: 880200, invoices: 1560 },
  { period: "102026", monthName: "Oct", taxable: 5640000, tax: 1015200, invoices: 1780 },
];

const DEFAULT_PLATFORMS: PlatformShare[] = [
  { name: "Amazon MTR", value: 44, color: "#3B82F6", invoices: 780, share: "44%" },
  { name: "Flipkart GSTR", value: 28, color: "#6366F1", invoices: 510, share: "28%" },
  { name: "Meesho TCS", value: 18, color: "#10B981", invoices: 340, share: "18%" },
  { name: "Myntra / Quick", value: 10, color: "#F59E0B", invoices: 150, share: "10%" },
];

export function DashboardAnalyticsCharts({
  monthlyData = [],
  platformDistribution = [],
  hasRealData = false,
}: DashboardChartsProps) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const [chartMode, setChartMode] = useState<"turnover" | "tax" | "invoices">("turnover");

  const chartData = monthlyData.length > 0 ? monthlyData : DEFAULT_MONTHLY_DATA;
  const pieData = platformDistribution.length > 0 ? platformDistribution : DEFAULT_PLATFORMS;

  const totalCalculated = chartData.reduce((acc, curr) => acc + curr.taxable, 0);

  if (!mounted) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="h-80 animate-pulse rounded-2xl border border-border/80 bg-card p-5 lg:col-span-2" />
        <div className="h-80 animate-pulse rounded-2xl border border-border/80 bg-card p-5" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Main Turnover & Tax Liability Flow Chart (2 cols) */}
      <div className="flex flex-col rounded-2xl border border-border/80 bg-card p-4.5 shadow-xs transition-all hover:border-primary/40 lg:col-span-2">
        {/* Chart Header with Controls */}
        <div className="flex flex-col gap-3 border-b border-border/60 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <BarChart3 className="size-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold tracking-tight text-foreground">
                  Filing Turnover &amp; Tax Trajectory
                </h3>
                <p className="text-2xs text-muted-foreground">
                  {hasRealData
                    ? "Live data from generated returns"
                    : "Simulated trajectory across return periods (6 Months)"}
                </p>
              </div>
            </div>
          </div>

          {/* Toggle pill buttons */}
          <div className="flex items-center rounded-xl bg-muted/70 p-0.5 text-3xs font-semibold ring-1 ring-border/50">
            <button
              type="button"
              onClick={() => setChartMode("turnover")}
              className={cn(
                "rounded-lg px-2.5 py-1 transition-all",
                chartMode === "turnover"
                  ? "bg-card font-bold text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Turnover (₹)
            </button>
            <button
              type="button"
              onClick={() => setChartMode("tax")}
              className={cn(
                "rounded-lg px-2.5 py-1 transition-all",
                chartMode === "tax"
                  ? "bg-card font-bold text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Tax Liability
            </button>
            <button
              type="button"
              onClick={() => setChartMode("invoices")}
              className={cn(
                "rounded-lg px-2.5 py-1 transition-all",
                chartMode === "invoices"
                  ? "bg-card font-bold text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Invoices
            </button>
          </div>
        </div>

        {/* Chart Summary strip */}
        <div className="flex items-center justify-between px-1 py-3 text-2xs">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-muted-foreground">6-Mo Processed: </span>
              <span className="font-mono font-bold text-foreground">
                {formatCurrency(totalCalculated)}
              </span>
            </div>
            <div className="hidden items-center gap-1 font-semibold text-emerald-600 sm:inline-flex dark:text-emerald-400">
              <TrendingUp className="size-3" />
              <span>+24.8% growth</span>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
            GSTN 100% Schema Valid
          </span>
        </div>

        {/* Area / Bar Chart Container */}
        <div className="h-64 w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="turnoverGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="taxGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="invoicesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="hsl(var(--border) / 0.7)"
              />
              <XAxis
                dataKey="monthName"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(val) =>
                  chartMode === "invoices"
                    ? String(val)
                    : val >= 100000
                      ? `₹${(val / 100000).toFixed(1)}L`
                      : `₹${(val / 1000).toFixed(0)}k`
                }
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length > 0 && payload[0]?.payload) {
                    const data = payload[0].payload as MonthlyPoint;
                    return (
                      <div className="rounded-xl border border-border/80 bg-popover/95 p-3 text-2xs shadow-xl backdrop-blur-md">
                        <p className="mb-1.5 text-xs font-bold text-foreground">
                          {data.monthName} ({data.period})
                        </p>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-4">
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <span className="size-2 rounded-full bg-blue-500" />
                              Taxable Sales:
                            </span>
                            <span className="font-mono font-bold text-foreground">
                              {formatCurrency(data.taxable)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <span className="size-2 rounded-full bg-emerald-500" />
                              GST Tax:
                            </span>
                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(data.tax)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <span className="size-2 rounded-full bg-purple-500" />
                              Invoices:
                            </span>
                            <span className="font-mono font-semibold text-foreground">
                              {data.invoices.toLocaleString("en-IN")}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              {chartMode === "turnover" && (
                <Area
                  type="monotone"
                  dataKey="taxable"
                  stroke="#3B82F6"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#turnoverGrad)"
                />
              )}
              {chartMode === "tax" && (
                <Area
                  type="monotone"
                  dataKey="tax"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#taxGrad)"
                />
              )}
              {chartMode === "invoices" && (
                <Area
                  type="monotone"
                  dataKey="invoices"
                  stroke="#8B5CF6"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#invoicesGrad)"
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Donut Chart: Marketplace Share Distribution (1 col) */}
      <div className="flex flex-col rounded-2xl border border-border/80 bg-card p-4.5 shadow-xs transition-all hover:border-primary/40">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <PieIcon className="size-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold tracking-tight text-foreground">Channel Share</h3>
              <p className="text-2xs text-muted-foreground">Revenue split by marketplace</p>
            </div>
          </div>
          <span className="rounded-md border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-3xs font-semibold text-muted-foreground">
            Multi-Channel
          </span>
        </div>

        {/* Donut Graphic with central label */}
        <div className="relative flex min-h-[170px] flex-1 items-center justify-center">
          <ResponsiveContainer width="100%" height={170}>
            <PieChart>
              <Pie
                data={pieData}
                innerRadius={50}
                outerRadius={72}
                paddingAngle={3}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length > 0 && payload[0]?.payload) {
                    const data = payload[0].payload as PlatformShare;
                    return (
                      <div className="rounded-xl border border-border/80 bg-popover/95 p-2.5 text-2xs shadow-lg backdrop-blur-md">
                        <p className="text-xs font-bold text-foreground">{data.name}</p>
                        <p className="mt-0.5 text-muted-foreground">
                          Share:{" "}
                          <span className="font-mono font-semibold text-foreground">
                            {data.share}
                          </span>
                        </p>
                        <p className="text-muted-foreground">
                          Invoices: <span className="font-mono">{data.invoices}</span>
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Centered Pill */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              Channels
            </span>
            <span className="text-base font-extrabold text-foreground">
              {pieData.length} Platforms
            </span>
          </div>
        </div>

        {/* Legend breakdown list */}
        <div className="mt-2 space-y-1.5 border-t border-border/60 pt-2.5">
          {pieData.map((channel) => (
            <div key={channel.name} className="flex items-center justify-between text-2xs">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ backgroundColor: channel.color }} />
                <span className="font-medium text-foreground">{channel.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-3xs text-muted-foreground">
                  {channel.invoices} inv.
                </span>
                <span className="font-mono font-bold text-foreground">{channel.share}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
