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
      <div className="grid gap-4 rounded-2xl border border-border bg-card p-5 md:grid-cols-[1fr_auto] md:items-center">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary-ink">
            <Wallet className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
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
