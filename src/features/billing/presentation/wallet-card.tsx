import Link from "next/link";
import { ArrowRight, Gift, Wallet, Zap } from "lucide-react";
import type { WalletSummary } from "@/features/billing/types/billing.types";

/** Server component — the summary is already narrowed and serialisable. */
export function WalletCard({ summary }: { summary: WalletSummary }) {
  if (summary.isOnFreeTrial) {
    return (
      <div className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/5 p-5">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
          <Gift className="size-4 text-amber-500" /> Free Trial
        </div>
        <p className="text-2xl font-bold">
          {summary.freeGenerationsRemaining} free{" "}
          {summary.freeGenerationsRemaining === 1 ? "return" : "returns"} left
        </p>
        <p className="text-xs text-muted-foreground">
          Trial returns carry a watermark. Recharge your wallet to remove it and keep generating.
        </p>
        <Link
          href="/billing"
          className="inline-flex items-center gap-1 pt-2 text-xs font-semibold text-amber-600 hover:underline"
        >
          Activate wallet <ArrowRight className="size-3" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
        <Wallet className="size-4 text-primary" /> Wallet Balance
      </div>
      <p className="text-2xl font-bold">{summary.balance.toLocaleString("en-IN")} Credits</p>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Zap className="size-3 text-amber-500" />
        {summary.estimatedReports} {summary.estimatedReports === 1 ? "return" : "returns"} left ·{" "}
        {summary.generationCost} credits each
      </p>
      {summary.isFrozen ? (
        <p className="pt-2 text-xs font-semibold text-destructive">
          Wallet frozen — contact support.
        </p>
      ) : (
        <Link
          href="/billing"
          className="inline-flex items-center gap-1 pt-2 text-xs font-semibold text-primary hover:underline"
        >
          Recharge wallet <ArrowRight className="size-3" />
        </Link>
      )}
    </div>
  );
}
