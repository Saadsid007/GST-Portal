"use client";

import { useEffect, useState, useTransition } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, Sparkles, Wallet } from "lucide-react";
import {
  createRechargeOrderAction,
  getRechargeOptionsAction,
  previewRechargeAction,
  verifyPaymentAction,
} from "@/features/billing/actions/recharge.actions";
import {
  MAX_RECHARGE_AMOUNT,
  MIN_RECHARGE_AMOUNT,
} from "@/features/billing/constants/billing.constants";
import type { BonusBreakdown, RechargePack } from "@/features/billing/types/billing.types";

/**
 * Razorpay Checkout is injected by their own script tag, so the handle it hangs on
 * `window` has no bundled types. This is the narrowest shape we actually call.
 */
interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
  modal: { ondismiss: () => void };
  theme: { color: string };
}

interface RazorpayInstance {
  open: () => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

type Pack = RechargePack & { breakdown: BonusBreakdown };

export function RechargePanel() {
  const router = useRouter();
  const [packs, setPacks] = useState<Pack[]>([]);
  const [generationCost, setGenerationCost] = useState(6);
  const [custom, setCustom] = useState("");
  const [preview, setPreview] = useState<BonusBreakdown | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    void getRechargeOptionsAction().then((result) => {
      if (!result.success) return;
      setPacks(result.data.packs);
      setGenerationCost(result.data.generationCost);
      setSelected(result.data.packs.find((pack) => pack.popular)?.amount ?? null);
    });
  }, []);

  // Priced by the same server code the order uses, so the preview can never
  // promise a bonus the settlement won't grant.
  const customAmount = Number(custom);
  const customIsValid =
    custom !== "" && Number.isInteger(customAmount) && customAmount >= MIN_RECHARGE_AMOUNT;

  useEffect(() => {
    if (!customIsValid) return;
    let stale = false;
    void previewRechargeAction(customAmount).then((result) => {
      if (!stale) setPreview(result.success ? result.data : null);
    });
    return () => {
      stale = true;
    };
  }, [customAmount, customIsValid]);

  // Derived, so a stale preview from a previous keystroke can never be shown.
  const livePreview = customIsValid && preview?.amount === customAmount ? preview : null;

  const activeAmount = custom ? (customIsValid ? customAmount : null) : selected;
  const activeBreakdown = custom
    ? livePreview
    : (packs.find((pack) => pack.amount === selected)?.breakdown ?? null);

  function handleRecharge() {
    if (!activeAmount || !activeBreakdown) return;

    startTransition(async () => {
      const order = await createRechargeOrderAction(activeAmount);
      if (!order.success) {
        toast.error(order.error);
        return;
      }
      if (!window.Razorpay) {
        toast.error("Payment window could not load. Please refresh and try again.");
        return;
      }

      const checkout = new window.Razorpay({
        key: order.data.keyId,
        amount: order.data.amountPaise,
        currency: "INR",
        name: "GSTPilot",
        description: `${order.data.breakdown.totalCredits} wallet credits`,
        order_id: order.data.orderId,
        handler: (response) => {
          void verifyPaymentAction({
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          }).then((result) => {
            if (result.success) {
              toast.success(`${order.data.breakdown.totalCredits} credits added to your wallet.`);
              setCustom("");
              router.refresh();
            } else {
              // The webhook is authoritative, so a failed fast path is not fatal.
              toast.warning(
                `${result.error} If you were charged, your credits will arrive shortly.`
              );
            }
          });
        },
        modal: { ondismiss: () => toast.info("Payment cancelled") },
        theme: { color: "#0f172a" },
      });
      checkout.open();
    });
  }

  return (
    <div className="space-y-5">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {packs.map((pack) => {
          const isActive = !custom && selected === pack.amount;
          return (
            <button
              key={pack.id}
              type="button"
              onClick={() => {
                setCustom("");
                setSelected(pack.amount);
              }}
              className={`relative space-y-1.5 rounded-xl border p-4 text-left transition ${
                isActive
                  ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                  : "border-border bg-card hover:border-primary/50"
              }`}
            >
              {pack.popular && (
                <span className="absolute -top-2 right-3 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase">
                  Most Popular
                </span>
              )}
              <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                {pack.label}
              </p>
              <p className="text-xl font-bold">₹{pack.amount.toLocaleString("en-IN")}</p>
              <p className="text-xs text-muted-foreground">
                {pack.breakdown.totalCredits.toLocaleString("en-IN")} credits
                {pack.breakdown.bonusCredits > 0 && (
                  <span className="font-semibold text-emerald-600">
                    {" "}
                    (+{pack.breakdown.bonusCredits} bonus)
                  </span>
                )}
              </p>
              <p className="text-[11px] text-muted-foreground">
                ≈ {Math.floor(pack.breakdown.totalCredits / generationCost)} returns
              </p>
              {isActive && <Check className="absolute right-3 bottom-3 size-4 text-primary" />}
            </button>
          );
        })}
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <label
          className="text-xs font-bold tracking-wide text-muted-foreground uppercase"
          htmlFor="customAmount"
        >
          Or enter a custom amount
        </label>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-muted-foreground">₹</span>
          <input
            id="customAmount"
            type="number"
            inputMode="numeric"
            min={MIN_RECHARGE_AMOUNT}
            max={MAX_RECHARGE_AMOUNT}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder={`${MIN_RECHARGE_AMOUNT} – ${MAX_RECHARGE_AMOUNT}`}
            className="flex-1 rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm transition focus:ring-2 focus:ring-primary/50 focus:outline-none"
          />
        </div>

        {livePreview && (
          <div className="grid grid-cols-3 gap-2 pt-1 text-center">
            <div className="rounded-lg bg-muted/50 p-2.5">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Recharge</p>
              <p className="text-sm font-bold">₹{livePreview.amount.toLocaleString("en-IN")}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-2.5">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Bonus</p>
              <p className="text-sm font-bold text-emerald-600">
                +{livePreview.bonusCredits} ({livePreview.bonusPercent}%)
              </p>
            </div>
            <div className="rounded-lg bg-primary/10 p-2.5">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">You get</p>
              <p className="text-sm font-bold">
                {livePreview.totalCredits.toLocaleString("en-IN")}
              </p>
            </div>
          </div>
        )}

        {livePreview?.campaignName && (
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-600">
            <Sparkles className="size-3.5" /> {livePreview.campaignName} bonus applied
          </p>
        )}

        {custom && !livePreview && (
          <p className="text-xs text-muted-foreground">
            Enter a whole rupee amount between ₹{MIN_RECHARGE_AMOUNT} and ₹
            {MAX_RECHARGE_AMOUNT.toLocaleString("en-IN")}.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={handleRecharge}
        disabled={pending || !activeAmount || !activeBreakdown}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-md shadow-primary/20 transition hover:bg-primary/90 disabled:opacity-50"
      >
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Opening payment…
          </>
        ) : (
          <>
            <Wallet className="size-4" />
            {activeBreakdown
              ? `Pay ₹${activeBreakdown.amount.toLocaleString("en-IN")} · get ${activeBreakdown.totalCredits.toLocaleString("en-IN")} credits`
              : "Select an amount"}
          </>
        )}
      </button>
    </div>
  );
}
