"use client";

import { useState } from "react";
import type { GSTINCapacityStatus } from "@/features/billing/services/capacity.service";
import type { SubscriptionStatusSummary } from "@/features/billing/services/subscription.service";
import { AddGstinModal } from "@/features/billing/presentation/add-gstin-modal";
import { Plus, Sparkles, AlertTriangle, CheckCircle2 } from "lucide-react";

interface Props {
  capacity: GSTINCapacityStatus;
  subscription: SubscriptionStatusSummary;
  onRefresh?: () => void;
}

export function GstinUsageWidget({ capacity, subscription, onRefresh }: Props) {
  const [modalOpen, setModalOpen] = useState(false);

  const percent = Math.min(100, capacity.usagePercent);
  const isLimitReached = capacity.status === "LIMIT_REACHED";
  const isWarning90 = capacity.status === "WARNING_90";
  const isWarning80 = capacity.status === "WARNING_80";

  let barColor = "bg-primary-ink";
  if (isLimitReached) barColor = "bg-destructive";
  else if (isWarning90) barColor = "bg-amber-500";
  else if (isWarning80) barColor = "bg-amber-400";

  return (
    <>
      <div className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              GSTIN Client Capacity
            </span>
            <h3 className="mt-0.5 text-xl font-extrabold text-foreground">
              {capacity.used} <span className="text-sm font-medium text-muted-foreground">/ {capacity.totalCapacity} GSTINs Used</span>
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-2 text-xs font-bold text-primary-ink transition hover:bg-primary/20 active:scale-95"
            >
              <Plus className="size-3.5" /> Add Extra GSTINs
            </button>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="space-y-1.5">
          <div className="h-3 w-full overflow-hidden rounded-full bg-secondary/50 p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{capacity.available} available slot{capacity.available === 1 ? "" : "s"}</span>
            <span>{percent}% capacity utilised</span>
          </div>
        </div>

        {/* Capacity Breakdown Pills */}
        <div className="grid grid-cols-2 gap-2 pt-1 text-xs sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-background p-2.5">
            <p className="text-[11px] text-muted-foreground">Plan Included</p>
            <p className="mt-0.5 font-bold text-foreground">{capacity.included} GSTINs</p>
          </div>
          <div className="rounded-xl border border-border bg-background p-2.5">
            <p className="text-[11px] text-muted-foreground">Add-on Capacity</p>
            <p className="mt-0.5 font-bold text-foreground">+{capacity.additional} GSTINs</p>
          </div>
          <div className="rounded-xl border border-border bg-background p-2.5">
            <p className="text-[11px] text-muted-foreground">Active Profiles</p>
            <p className="mt-0.5 font-bold text-foreground">{capacity.used} GSTINs</p>
          </div>
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-2.5">
            <p className="text-[11px] font-semibold text-primary-ink">Total Capacity</p>
            <p className="mt-0.5 font-bold text-primary-ink">{capacity.totalCapacity} GSTINs</p>
          </div>
        </div>

        {/* Status Alerts */}
        {isLimitReached && (
          <div className="flex items-start gap-2.5 rounded-xl border border-destructive/40 bg-destructive/10 p-3.5 text-xs">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div>
              <p className="font-bold text-foreground">GSTIN Limit Reached (100%)</p>
              <p className="mt-0.5 text-muted-foreground">
                You have utilised all {capacity.totalCapacity} GSTIN slots. Purchase extra GSTINs for ₹6/month each or upgrade your plan to add more clients.
              </p>
            </div>
          </div>
        )}

        {isWarning90 && !isLimitReached && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-bold text-foreground">Capacity Almost Full (90%+)</p>
              <p className="mt-0.5 text-muted-foreground">
                Only {capacity.available} GSTIN slot remaining. Consider adding extra capacity to avoid onboarding delays.
              </p>
            </div>
          </div>
        )}

        {isWarning80 && !isWarning90 && !isLimitReached && (
          <div className="flex items-start gap-2.5 rounded-xl border border-blue-500/30 bg-blue-500/5 p-3.5 text-xs">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="font-bold text-foreground">You are using {capacity.used} of {capacity.totalCapacity} GSTIN slots</p>
              <p className="mt-0.5 text-muted-foreground">
                Additional slots can be added at any time for just ₹6/month (prorated).
              </p>
            </div>
          </div>
        )}

        {!isWarning80 && !isWarning90 && !isLimitReached && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="size-3.5 text-emerald-500" />
            <span>Capacity healthy. Multi-marketplace files under the same GSTIN do not consume extra slots.</span>
          </div>
        )}
      </div>

      <AddGstinModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        capacity={capacity}
        subscription={subscription}
        onSuccess={() => {
          setModalOpen(false);
          onRefresh?.();
        }}
      />
    </>
  );
}
