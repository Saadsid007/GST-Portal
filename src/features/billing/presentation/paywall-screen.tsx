"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, Sparkles, Wallet } from "lucide-react";
import type { WalletSummary } from "@/features/billing/types/billing.types";

interface Props {
  summary: WalletSummary;
  /** Set when the gate refused, so the user sees the exact reason. */
  reason?: string | null;
}

/**
 * Shown in place of the generate button once the trial is exhausted and the
 * balance is below the generation cost. Deliberately keeps the user's work
 * intact — nothing is discarded, they recharge and come back to step 9.
 */
export function PaywallScreen({ summary, reason }: Props) {
  const frozen = summary.isFrozen;

  return (
    <div className="space-y-5 rounded-2xl border border-primary/40 bg-primary/5 p-6">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-primary/15 p-2.5">
          {frozen ? (
            <AlertTriangle className="size-5 text-destructive" />
          ) : (
            <Wallet className="size-5 text-primary-ink" />
          )}
        </span>
        <div>
          <h3 className="font-bold">
            {frozen ? "Your wallet is on hold" : "Recharge your wallet to generate this return"}
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {reason ??
              (frozen
                ? "Generation is paused while your wallet is under review. Please contact support."
                : `Your free trial generations are used up. Each GSTR-1 return costs ${summary.generationCost} credits and your balance is ${summary.balance}.`)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl border border-border bg-background p-3">
          <p className="text-xs text-muted-foreground">Wallet Balance</p>
          <p className="mt-1 text-lg font-bold">{summary.balance}</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-3">
          <p className="text-xs text-muted-foreground">Cost per Return</p>
          <p className="mt-1 text-lg font-bold">{summary.generationCost}</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-3">
          <p className="text-xs text-muted-foreground">Free Generations Left</p>
          <p className="mt-1 text-lg font-bold">{summary.freeGenerationsRemaining}</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Your uploaded files and corrections are safe. Recharge in another tab, come back to this
        step and generate — nothing needs to be redone.
      </p>

      {!frozen && (
        <Link
          href="/billing"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90"
        >
          <Sparkles className="size-4" />
          <span>Recharge Wallet</span>
          <ArrowRight className="size-4" />
        </Link>
      )}
    </div>
  );
}
