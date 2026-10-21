import Link from "next/link";
import { Gift, Wallet } from "lucide-react";
import { TransactionTable } from "@/features/billing/presentation/transaction-table";

/**
 * The wallet, as it works now: credits are rupees off the next purchase.
 *
 * Returns are unlimited on every plan, so credits are not spent per return any
 * more. Whatever the balance is comes off the next plan, renewal or GSTIN
 * add-on at checkout, automatically, until it is used up.
 */
export function WalletCreditsSection({
  balance,
  isFrozen,
  referralEarned,
}: {
  balance: number;
  isFrozen: boolean;
  referralEarned: number;
}) {
  return (
    <section className="space-y-4">
      <div className="grid gap-4 rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-500/[0.12] via-indigo-500/[0.04] to-card p-5 shadow-xs transition-all hover:border-purple-500/50 hover:shadow-md hover:shadow-purple-500/5 md:grid-cols-[1fr_auto] md:items-center dark:from-purple-950/60 dark:via-indigo-950/30 dark:to-card/90">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-purple-500/15 text-purple-600 ring-1 ring-purple-500/30 dark:bg-purple-500/25 dark:text-purple-400">
            <Wallet className="size-5.5" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-bold tracking-wider text-purple-700 uppercase dark:text-purple-300">
              Wallet credits
            </p>
            <p className="mt-0.5 text-2xl font-bold tracking-tight tabular-nums">
              {balance.toLocaleString("en-IN")}
              <span className="ml-1.5 text-sm font-medium text-muted-foreground">
                = ₹{balance.toLocaleString("en-IN")} off
              </span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isFrozen
                ? "This wallet is on hold. Contact support to release it."
                : balance > 0
                  ? "Taken off your next plan, renewal or GSTIN add-on automatically — no code needed."
                  : "Earn credits by inviting other sellers or redeeming a code. 1 credit = ₹1 off any purchase."}
              {referralEarned > 0 && ` ${referralEarned} earned from referrals so far.`}
            </p>
          </div>
        </div>
        <Link
          href="/refer"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-semibold transition hover:bg-accent"
        >
          <Gift className="size-4" aria-hidden /> Earn credits
        </Link>
      </div>
      <TransactionTable />
    </section>
  );
}
