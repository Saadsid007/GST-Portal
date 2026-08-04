import type { Metadata } from "next";
import { requireSession } from "@/features/auth";
import { getWalletSummary } from "@/features/billing/services/entitlement.service";
import { getReferralSummary } from "@/features/billing/services/referral.service";
import { RechargePanel } from "@/features/billing/presentation/recharge-panel";
import { RedeemCodePanel } from "@/features/billing/presentation/redeem-code-panel";
import { ReferralPanel } from "@/features/billing/presentation/referral-panel";
import { TransactionTable } from "@/features/billing/presentation/transaction-table";
import { Gift, Snowflake, TrendingUp, Wallet, Zap } from "lucide-react";

export const metadata: Metadata = { title: "Wallet & Billing — GSTPilot" };

export default async function BillingPage() {
  const session = await requireSession();
  const [wallet, referral] = await Promise.all([
    getWalletSummary(session.user.id),
    getReferralSummary(session.user.id),
  ]);

  return (
    <div className="space-y-8">
      <div className="space-y-5 rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-6 shadow-sm md:p-8">
        <div className="space-y-1">
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold tracking-wider text-primary uppercase">
            Wallet
          </span>
          <h1 className="pt-1 text-2xl font-bold">
            {wallet.balance.toLocaleString("en-IN")} Credits
          </h1>
          <p className="text-sm text-muted-foreground">
            1 credit = ₹1. One GSTR-1 return costs {wallet.generationCost} credits. Credits never
            expire.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            icon={<Zap className="size-4 text-amber-500" />}
            label="Returns Left"
            value={String(wallet.estimatedReports)}
          />
          <Stat
            icon={<TrendingUp className="size-4 text-emerald-500" />}
            label="Lifetime Recharged"
            value={`₹${wallet.lifetimeRecharged.toLocaleString("en-IN")}`}
          />
          <Stat
            icon={<Gift className="size-4 text-violet-500" />}
            label="Bonus Earned"
            value={String(wallet.bonusEarned)}
          />
          <Stat
            icon={<Wallet className="size-4 text-primary" />}
            label="Credits Used"
            value={String(wallet.lifetimeUsed)}
          />
        </div>

        {wallet.isFrozen && (
          <p className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-3.5 py-2.5 text-xs font-semibold text-destructive">
            <Snowflake className="size-4" /> Your wallet is frozen. Generations and referral rewards
            are paused — please contact support.
          </p>
        )}

        {wallet.isOnFreeTrial && (
          <p className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/5 px-3.5 py-2.5 text-xs font-semibold text-amber-600">
            <Gift className="size-4" /> Free trial: {wallet.freeGenerationsRemaining} watermarked{" "}
            {wallet.freeGenerationsRemaining === 1 ? "return" : "returns"} remaining. Recharge to
            remove the watermark.
          </p>
        )}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-bold">Recharge your wallet</h2>
        <RechargePanel />
      </section>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <ReferralPanel summary={referral} />
        <RedeemCodePanel />
      </div>

      <TransactionTable />
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="space-y-1 rounded-xl border border-border bg-card p-4">
      <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
        {icon} {label}
      </p>
      <p className="text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}
