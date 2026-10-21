"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, TicketPercent, Gift } from "lucide-react";
import { redeemCreditCodeAction } from "@/features/billing/actions/credit-code.actions";

export function RedeemCodePanel() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();

  function handleRedeem() {
    startTransition(async () => {
      const result = await redeemCreditCodeAction(code);
      if (result.success) {
        toast.success(
          `Success! ${result.data.credits} credits added to your wallet. New balance: ₹${result.data.balanceAfter}.`
        );
        setCode("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-4 rounded-3xl border border-purple-500/30 bg-gradient-to-br from-card via-card to-purple-500/[0.04] p-6 shadow-xs dark:from-card dark:via-card dark:to-purple-950/20">
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-purple-500/15 text-purple-600 ring-1 ring-purple-500/30 dark:text-purple-400">
            <TicketPercent className="size-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Redeem Voucher / Gift Code</h3>
            <p className="text-2xs text-muted-foreground">Promotional &amp; support credit codes</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/15 px-2.5 py-0.5 text-2xs font-extrabold text-purple-700 dark:text-purple-300">
          <Gift className="size-3" />
          Instant Balance
        </span>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="GIFT-XXXXXX"
          className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 font-mono text-sm tracking-wider uppercase transition focus:ring-2 focus:ring-purple-500/50 focus:outline-none"
        />
        <button
          type="button"
          onClick={handleRedeem}
          disabled={pending || code.trim().length < 4}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-purple-500/25 transition hover:brightness-110 disabled:opacity-50"
        >
          {pending && <Loader2 className="size-3.5 animate-spin" />}
          <span>Redeem Code</span>
        </button>
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Credit codes grant their exact face value (1 Credit = ₹1). Applied instantly to your active
        wallet balance with no expiration.
      </p>
    </div>
  );
}
