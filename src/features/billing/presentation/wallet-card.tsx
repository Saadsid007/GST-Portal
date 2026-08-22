import Link from "next/link";
import { ArrowRight, Gift, Wallet, Zap } from "lucide-react";
import type { WalletSummary } from "@/features/billing/types/billing.types";

/** Server component — the summary is already narrowed and serialisable. */
export function WalletCard({ summary }: { summary: WalletSummary }) {
  if (summary.isOnFreeTrial) {
    return (
      <div className="card-lift space-y-1.5 rounded-xl border border-warning/40 bg-warning/5 p-4 hover:border-warning/60">
        <div className="flex items-center gap-1.5 text-3xs font-semibold text-muted-foreground uppercase">
          <Gift className="size-3.5 text-warning" /> Free Trial
        </div>
        <p className="text-xl font-bold text-foreground">
          {summary.freeGenerationsRemaining} free{" "}
          {summary.freeGenerationsRemaining === 1 ? "return" : "returns"} left
        </p>
        <p className="text-3xs text-muted-foreground truncate">
          30-Day Free Trial · 7 GSTIN slots active
        </p>
        <Link
          href="/billing"
          className="inline-flex items-center gap-1 pt-1 text-2xs font-semibold text-warning hover:underline"
        >
          Manage plan <ArrowRight className="size-3" />
        </Link>
      </div>
    );
  }

  return (
    <div className="card-lift space-y-1.5 rounded-xl border border-border bg-card p-4 hover:border-primary/40">
      <div className="flex items-center gap-1.5 text-3xs font-semibold text-muted-foreground uppercase">
        <Wallet className="size-3.5 text-primary-ink" /> Wallet Balance
      </div>
      <p className="text-xl font-bold text-foreground">{summary.balance.toLocaleString("en-IN")} Credits</p>
      <p className="flex items-center gap-1 text-3xs text-muted-foreground truncate">
        <Zap className="size-3 text-warning" />
        {summary.estimatedReports} returns left · {summary.generationCost} cr/ea
      </p>
      {summary.isFrozen ? (
        <p className="pt-1 text-2xs font-semibold text-destructive">
          Wallet frozen — contact support.
        </p>
      ) : (
        <Link
          href="/billing"
          className="inline-flex items-center gap-1 pt-1 text-2xs font-semibold text-primary-ink hover:underline"
        >
          Recharge wallet <ArrowRight className="size-3" />
        </Link>
      )}
    </div>
  );
}
