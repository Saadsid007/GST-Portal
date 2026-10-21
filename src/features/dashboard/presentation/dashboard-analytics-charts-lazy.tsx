"use client";

import dynamic from "next/dynamic";

/**
 * Recharts is ~100KB compressed. Imported directly, the dashboard downloaded
 * and parsed it before anything appeared; loaded here, the page paints first
 * and the charts fill in their placeholders a moment later.
 */
export const DashboardAnalyticsCharts = dynamic(
  () =>
    import("@/features/dashboard/presentation/dashboard-analytics-charts").then(
      (m) => m.DashboardAnalyticsCharts
    ),
  {
    ssr: false,
    loading: () => (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="h-80 animate-pulse rounded-2xl border border-border/80 bg-card p-5 lg:col-span-2" />
        <div className="h-80 animate-pulse rounded-2xl border border-border/80 bg-card p-5" />
      </div>
    ),
  }
);
