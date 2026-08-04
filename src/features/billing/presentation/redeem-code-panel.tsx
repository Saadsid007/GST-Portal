"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, TicketPercent } from "lucide-react";
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
          `${result.data.credits} credits added. New balance: ${result.data.balanceAfter}.`
        );
        setCode("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 text-sm font-bold">
        <TicketPercent className="size-4 text-primary" /> Redeem a Credit Code
      </h2>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="GIFT-XXXXXX"
          className="flex-1 rounded-xl border border-border bg-background px-3.5 py-2.5 font-mono text-sm tracking-wide transition focus:ring-2 focus:ring-primary/50 focus:outline-none"
        />
        <button
          type="button"
          onClick={handleRedeem}
          disabled={pending || code.trim().length < 4}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          {pending && <Loader2 className="size-3.5 animate-spin" />} Redeem
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Credit codes grant their exact face value — no bonus slab is applied.
      </p>
    </div>
  );
}
