import type { Metadata } from "next";
import { requireSession } from "@/features/auth";
import { getWalletSummary } from "@/features/billing/services/entitlement.service";
import { RechargePanel } from "@/features/billing/presentation/recharge-panel";
import { TransactionTable } from "@/features/billing/presentation/transaction-table";
import Link from "next/link";
import { ArrowRight, Gift, Snowflake, TrendingUp, Wallet, Zap } from "lucide-react";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Wallet & Billing — GSTPilot" };

export default async function BillingPage() {
  const session = await requireSession();
  const wallet = await getWalletSummary(session.user.id);

  return (
    <div className="space-y-8">
      <div className="space-y-5 rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-6 shadow-sm md:p-8">
        <div className="space-y-1">
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold tracking-wider text-primary-ink uppercase">
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
            icon={<Zap className="size-4 text-warning" />}
            label="Returns Left"
            value={String(wallet.estimatedReports)}
          />
          <Stat
            icon={<TrendingUp className="size-4 text-success" />}
            label="Lifetime Recharged"
            value={`₹${wallet.lifetimeRecharged.toLocaleString("en-IN")}`}
          />
          <Stat
            icon={<Gift className="size-4 text-primary-ink" />}
            label="Bonus Earned"
            value={String(wallet.bonusEarned)}
          />
          <Stat
            icon={<Wallet className="size-4 text-primary-ink" />}
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
          <p className="flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/5 px-3.5 py-2.5 text-xs font-semibold text-warning">
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

      {/* Referrals and credit codes have their own page — this one stays about
          the wallet itself: balance, recharge, ledger. */}
      <Card variant="accent" className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
        <Gift className="size-5 flex-shrink-0 text-primary-ink" aria-hidden />
        <p className="flex-1 text-sm">
          Earn free credits by referring other sellers, or redeem a credit code you were given.
        </p>
        <Link
          href="/refer"
          className="inline-flex flex-shrink-0 items-center gap-1.5 text-xs font-semibold text-primary-ink hover:underline"
        >
          Refer &amp; earn
          <ArrowRight className="size-3" aria-hidden />
        </Link>
      </Card>

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
