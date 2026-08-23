import Link from "next/link";
import { Gift, Wallet } from "lucide-react";
import type { WalletSummary } from "@/features/billing/types/billing.types";

/** Server component — the summary is already narrowed and serialisable. */
export function WalletCard({ summary }: { summary: WalletSummary }) {
  if (summary.isOnFreeTrial) {
    return (
      <div className="flex card-lift flex-col justify-between rounded-xl border border-warning/40 bg-warning/5 p-3 hover:border-warning/60 sm:p-3.5">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-3xs font-bold tracking-wider text-muted-foreground uppercase">
              Active Plan
            </span>
            <Gift className="size-3.5 text-warning" />
          </div>
          <p className="mt-1 text-lg font-bold tracking-tight text-foreground sm:text-xl">
            Free Trial <span className="text-xs font-normal text-muted-foreground">· 7 GSTINs</span>
          </p>
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-border/50 pt-1.5 text-3xs">
          <span className="text-muted-foreground">Unlimited Returns</span>
          <Link href="/billing" className="shrink-0 font-semibold text-warning hover:underline">
            Manage &rarr;
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex card-lift flex-col justify-between rounded-xl border border-border bg-card p-3 hover:border-primary/40 sm:p-3.5">
      <div>
        <div className="flex items-center justify-between">
          <span className="text-3xs font-bold tracking-wider text-muted-foreground uppercase">
            Wallet Balance
          </span>
          <Wallet className="size-3.5 text-primary-ink" />
        </div>
        <p className="mt-1 text-lg font-bold tracking-tight text-foreground sm:text-xl">
          {summary.balance.toLocaleString("en-IN")}{" "}
          <span className="text-xs font-normal text-muted-foreground">Credits</span>
        </p>
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-border/50 pt-1.5 text-3xs">
        <span className="truncate text-muted-foreground">
          {summary.estimatedReports} returns left
        </span>
        <Link href="/billing" className="shrink-0 font-semibold text-primary-ink hover:underline">
          Recharge &rarr;
        </Link>
      </div>
    </div>
  );
}
