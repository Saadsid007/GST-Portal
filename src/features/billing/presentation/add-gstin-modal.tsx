"use client";

import { useEffect, useState, useTransition } from "react";
import type { GSTINCapacityStatus } from "@/features/billing/services/capacity.service";
import type { SubscriptionStatusSummary } from "@/features/billing/services/subscription.service";
import {
  calculateGstinProrationAction,
  confirmGstinAddonPaymentAction,
  createGstinAddonOrderAction,
} from "@/features/billing/actions/billing.actions";
import { X, Plus, Minus, Loader2, ShieldCheck, Zap } from "lucide-react";

declare global {
  interface Window {
    Razorpay?: any;
  }
}

interface Props {
  open: boolean;
  onClose: () => void;
  capacity: GSTINCapacityStatus;
  subscription: SubscriptionStatusSummary;
  onSuccess: () => void;
}

export function AddGstinModal({ open, onClose, capacity, subscription, onSuccess }: Props) {
  const [quantity, setQuantity] = useState(2);
  const [proratedAmount, setProratedAmount] = useState(12);
  const [fullAmount, setFullAmount] = useState(12);
  const [remainingDays, setRemainingDays] = useState(30);
  const [calcPending, startCalc] = useTransition();
  const [payPending, startPay] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    startCalc(async () => {
      const res = await calculateGstinProrationAction(quantity);
      if (res.success && res.data) {
        setProratedAmount(res.data.proratedAmount);
        setFullAmount(res.data.fullMonthlyAmount);
        setRemainingDays(res.data.remainingDays);
      }
    });
  }, [open, quantity]);

  if (!open) return null;

  function loadRazorpayScript(): Promise<boolean> {
    return new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  function handleCheckout() {
    setError(null);
    startPay(async () => {
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        setError("Failed to load Razorpay SDK. Please check your internet connection.");
        return;
      }

      const orderRes = await createGstinAddonOrderAction(quantity);
      if (!orderRes.success || !orderRes.data) {
        setError(orderRes.error || "Failed to create order.");
        return;
      }

      const orderData = orderRes.data;

      const options = {
        key: orderData.keyId,
        amount: orderData.amountPaise,
        currency: "INR",
        name: "GSTPilot",
        description: `Add ${quantity} GSTIN slot(s) for ${remainingDays} remaining days`,
        order_id: orderData.orderId,
        handler: async function (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) {
          const confirmRes = await confirmGstinAddonPaymentAction({
            orderId: response.razorpay_order_id,
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
            quantity,
            amountRupees: orderData.proration.proratedAmount,
          });

          if (confirmRes.success) {
            onSuccess();
          } else {
            setError(confirmRes.error || "Payment verification failed.");
          }
        },
        theme: {
          color: "#0F172A",
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (response: any) {
        setError(response.error?.description || "Payment was not completed.");
      });
      rzp.open();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl md:p-8">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <X className="size-5" />
        </button>

        <div className="space-y-1">
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold tracking-wider text-primary-ink uppercase">
            GSTIN Capacity Add-on
          </span>
          <h2 className="text-xl font-extrabold">Add Extra Client GSTINs</h2>
          <p className="text-xs text-muted-foreground">
            Scale your practice with flexible GSTIN packs at ₹6/month per GSTIN (prorated for remaining days).
          </p>
        </div>

        <div className="my-6 space-y-4 rounded-2xl border border-border bg-background p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Select Quantity</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1 || payPending}
                className="flex size-8 items-center justify-center rounded-lg border border-border text-foreground transition hover:bg-accent disabled:opacity-40"
              >
                <Minus className="size-3.5" />
              </button>
              <span className="w-8 text-center text-base font-extrabold">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                disabled={payPending}
                className="flex size-8 items-center justify-center rounded-lg border border-border text-foreground transition hover:bg-accent disabled:opacity-40"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
          </div>

          <div className="space-y-2 border-t border-border pt-3 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Current Capacity</span>
              <span className="font-semibold text-foreground">{capacity.totalCapacity} GSTINs</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>New Total Capacity</span>
              <span className="font-bold text-primary-ink">{capacity.totalCapacity + quantity} GSTINs</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Standard Monthly Rate</span>
              <span>₹{fullAmount} (₹6/mo each)</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Remaining Days in Billing Cycle</span>
              <span className="font-medium text-foreground">{remainingDays} days</span>
            </div>
          </div>

          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-primary-ink">Total Payable (Prorated)</p>
                <p className="text-[11px] text-muted-foreground">Calculated for {remainingDays} remaining days</p>
              </div>
              <div className="text-right">
                {calcPending ? (
                  <Loader2 className="size-4 animate-spin text-primary-ink" />
                ) : (
                  <p className="text-2xl font-black text-primary-ink">₹{proratedAmount}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs font-semibold text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleCheckout}
            disabled={payPending || calcPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl brand-gradient py-3 text-sm font-bold text-white shadow-lg transition hover:brightness-110 active:scale-98 disabled:opacity-50"
          >
            {payPending ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
            <span>Pay ₹{proratedAmount} &amp; Activate {quantity} GSTINs</span>
          </button>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="size-3.5 text-emerald-500" />
            <span>Instant activation via Razorpay • 100% Secure Checkout</span>
          </div>
        </div>
      </div>
    </div>
  );
}
