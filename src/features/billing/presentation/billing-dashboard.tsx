"use client";

import { useState } from "react";
import type { BillingOverview } from "@/features/billing/actions/billing.actions";
import { GstinUsageWidget } from "@/features/billing/presentation/gstin-usage-widget";
import { PlanComparisonGrid } from "@/features/billing/presentation/plan-comparison-grid";
import { PaymentHistoryTable } from "@/features/billing/presentation/payment-history-table";
import { cancelAutoRenewalAction } from "@/features/billing/actions/billing.actions";
import {
  ShieldCheck,
  Calendar,
  Zap,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface Props {
  initialData: BillingOverview;
}

export function BillingDashboard({ initialData }: Props) {
  const [data, setData] = useState<BillingOverview>(initialData);
  const [cancelling, setCancelling] = useState(false);
  const router = useRouter();

  const sub = data.subscription;
  const cap = data.capacity;
  const isTrial = sub.isTrial;
  const isExpired = sub.isExpired;

  async function handleCancelAutoRenew() {
    if (!confirm("Are you sure you want to cancel auto-renewal? Your plan will remain active until the end of the current billing cycle.")) {
      return;
    }
    setCancelling(true);
    const res = await cancelAutoRenewalAction();
    setCancelling(false);
    if (res.success) {
      router.refresh();
    } else {
      alert(res.error || "Failed to cancel auto-renewal.");
    }
  }

  return (
    <div className="space-y-8">
      {/* Header Plan Overview Banner */}
      <div className="space-y-6 rounded-3xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold tracking-wider text-primary-ink uppercase">
                Active Subscription
              </span>
              {isTrial ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-bold text-blue-600 dark:text-blue-400">
                  <Sparkles className="size-3" /> 30-Day Free Trial
                </span>
              ) : isExpired ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-bold text-destructive">
                  <AlertTriangle className="size-3" /> Expired
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="size-3" /> Active Plan
                </span>
              )}
            </div>

            <h1 className="text-2xl font-black text-foreground md:text-3xl">
              {sub.planName}
            </h1>
            <p className="text-sm text-muted-foreground">
              Unlimited GSTR-1 return generations included. Client capacity: {cap.totalCapacity} GSTINs.
            </p>
          </div>

          {/* Pricing & Renewal Pill */}
          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-background p-4 text-xs sm:flex-row sm:items-center">
            <div className="pr-4 border-r border-border">
              <p className="text-muted-foreground">Plan Billing</p>
              <p className="text-base font-bold text-foreground">
                {isTrial ? "₹0 / 30 Days" : `₹${sub.monthlyPrice} / month`}
              </p>
            </div>

            <div className="pl-1">
              <p className="text-muted-foreground">
                {isExpired ? "Expired On" : "Renewal Date"}
              </p>
              <p className="flex items-center gap-1.5 font-bold text-foreground">
                <Calendar className="size-3.5 text-primary-ink" />
                {new Date(sub.endDate).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}{" "}
                ({sub.daysRemaining} days left)
              </p>
            </div>
          </div>
        </div>

        {/* Quick Highlights Bar */}
        <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4">
          <div className="space-y-1 rounded-2xl border border-border bg-background p-4">
            <p className="text-xs text-muted-foreground">GSTR-1 Generation</p>
            <p className="flex items-center gap-1.5 text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
              <Zap className="size-4" /> Unlimited
            </p>
          </div>

          <div className="space-y-1 rounded-2xl border border-border bg-background p-4">
            <p className="text-xs text-muted-foreground">GSTIN Capacity</p>
            <p className="text-sm font-extrabold text-foreground">
              {cap.used} / {cap.totalCapacity} Used
            </p>
          </div>

          <div className="space-y-1 rounded-2xl border border-border bg-background p-4">
            <p className="text-xs text-muted-foreground">Add-on Cost</p>
            <p className="text-sm font-extrabold text-primary-ink">
              ₹6 / GSTIN / mo
            </p>
          </div>

          <div className="space-y-1 rounded-2xl border border-border bg-background p-4">
            <p className="text-xs text-muted-foreground">Auto-Renewal</p>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-foreground">
                {sub.autoRenew ? "Enabled" : "Off"}
              </p>
              {sub.autoRenew && !isTrial && !isExpired && (
                <button
                  type="button"
                  onClick={handleCancelAutoRenew}
                  disabled={cancelling}
                  className="text-[11px] font-semibold text-muted-foreground hover:text-destructive hover:underline"
                >
                  {cancelling ? <Loader2 className="size-3 animate-spin" /> : "Cancel"}
                </button>
              )}
            </div>
          </div>
        </div>

        {sub.scheduledPlanSlug && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs font-semibold text-amber-700 dark:text-amber-300">
            <RotateCcw className="size-4 shrink-0" />
            <span>
              Downgrade scheduled: Your subscription will switch to {sub.scheduledPlanSlug.replace("_", " ")} on{" "}
              {new Date(sub.endDate).toLocaleDateString("en-IN")}.
            </span>
          </div>
        )}
      </div>

      {/* GSTIN Usage Widget */}
      <GstinUsageWidget
        capacity={cap}
        subscription={sub}
        onRefresh={() => router.refresh()}
      />

      {/* Plan Selector Grid */}
      <PlanComparisonGrid
        plans={data.plans}
        currentSubscription={sub}
        onRefresh={() => router.refresh()}
      />

      {/* Payment History */}
      <PaymentHistoryTable history={data.paymentHistory} />
    </div>
  );
}
