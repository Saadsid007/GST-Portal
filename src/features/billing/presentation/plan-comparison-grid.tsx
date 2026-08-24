"use client";

import { useState, useTransition } from "react";
import type { PlanDefinition, PlanSlug } from "@/features/billing/config/pricing.config";
import type { SubscriptionStatusSummary } from "@/features/billing/services/subscription.service";
import {
  confirmPlanPaymentAction,
  createPlanSubscriptionOrderAction,
  scheduleDowngradeAction,
} from "@/features/billing/actions/billing.actions";
import { Check, Sparkles, Loader2, ShieldCheck, ArrowRight, Clock } from "lucide-react";
import {
  loadRazorpayCheckout,
  type RazorpayCheckoutResponse,
  type RazorpayFailureResponse,
} from "@/features/billing/types/razorpay-checkout";

interface Props {
  plans: PlanDefinition[];
  currentSubscription: SubscriptionStatusSummary;
  onRefresh?: () => void;
}

export function PlanComparisonGrid({ plans, currentSubscription, onRefresh }: Props) {
  const [selectedSlug, setSelectedSlug] = useState<PlanSlug | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSelectPlan(planSlug: PlanSlug) {
    if (planSlug === "free_trial" || planSlug === currentSubscription.planSlug) return;
    if (plans.find((p) => p.slug === planSlug)?.comingSoon) return;
    setError(null);
    setSelectedSlug(planSlug);

    startTransition(async () => {
      const currentPlanIndex = plans.findIndex((p) => p.slug === currentSubscription.planSlug);
      const targetPlanIndex = plans.findIndex((p) => p.slug === planSlug);

      // If user is selecting a lower tier plan while on an active paid plan -> Schedule Downgrade
      if (
        currentSubscription.isActive &&
        targetPlanIndex < currentPlanIndex &&
        currentSubscription.planSlug !== "free_trial"
      ) {
        const res = await scheduleDowngradeAction(planSlug);
        if (res.success) {
          onRefresh?.();
        } else {
          setError(res.error || "Failed to schedule downgrade.");
        }
        return;
      }

      // Otherwise -> Initiate Razorpay checkout for Upgrade/New Plan
      const Checkout = await loadRazorpayCheckout();
      if (!Checkout) {
        setError("Failed to load Razorpay SDK. Please check your internet connection.");
        return;
      }

      const orderRes = await createPlanSubscriptionOrderAction(planSlug);
      if (!orderRes.success || !orderRes.data) {
        setError(orderRes.error || "Failed to create checkout order.");
        return;
      }

      const orderData = orderRes.data;

      const options = {
        key: orderData.keyId,
        amount: orderData.amountPaise,
        currency: "INR",
        name: "GSTPilot",
        description: `${orderData.planName} Subscription Plan`,
        order_id: orderData.orderId,
        handler: async function (response: RazorpayCheckoutResponse) {
          const confirmRes = await confirmPlanPaymentAction({
            orderId: response.razorpay_order_id,
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          });

          if (confirmRes.success) {
            onRefresh?.();
          } else {
            setError(confirmRes.error || "Payment verification failed.");
          }
        },
        theme: {
          color: "#0F172A",
        },
      };

      const rzp = new Checkout(options);
      rzp.on("payment.failed", function (response: RazorpayFailureResponse) {
        setError(response.error?.description || "Payment was not completed.");
      });
      rzp.open();
    });
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold tracking-wider text-primary-ink uppercase">
          Subscription Plans
        </span>
        <h2 className="mt-2 text-2xl font-black md:text-3xl">
          One product. Every feature. Pick your GSTIN capacity.
        </h2>
        <p className="mx-auto mt-1 max-w-2xl text-sm text-muted-foreground">
          Every paid plan ships the same toolkit — unlimited GSTR-1 generation, all parsers,
          reconciliation, AI fixes and audit reports. The only difference between plans is how many
          client GSTINs you can keep active.
        </p>
      </div>

      {error && (
        <div className="mx-auto max-w-xl rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-center text-xs font-semibold text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = currentSubscription.planSlug === plan.slug;
          const isScheduled = currentSubscription.scheduledPlanSlug === plan.slug;
          const isTrial = plan.slug === "free_trial";
          const isComingSoon = plan.comingSoon === true;
          const isPopular = plan.isPopular && !isComingSoon;

          return (
            <div
              key={plan.slug}
              className={`relative flex flex-col justify-between rounded-3xl border p-6 transition-all duration-200 ${
                isPopular
                  ? "border-primary/50 bg-gradient-to-b from-card via-card to-primary/5 shadow-xl ring-2 ring-primary/20"
                  : isCurrent
                    ? "border-emerald-500/50 bg-emerald-500/5 shadow-md"
                    : isComingSoon
                      ? "border-dashed border-border bg-card/60 shadow-none"
                      : "border-border bg-card shadow-sm hover:border-border/80 hover:shadow-md"
              }`}
            >
              {/* Badge. A coming-soon tier gets its own, not a marketing one. */}
              {isComingSoon ? (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-0.5 text-[10px] font-extrabold tracking-wider text-muted-foreground uppercase">
                    Coming soon
                  </span>
                </div>
              ) : (
                plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 rounded-full brand-gradient px-3 py-0.5 text-[10px] font-extrabold tracking-wider text-white uppercase shadow-sm">
                      <Sparkles className="size-2.5" /> {plan.badge}
                    </span>
                  </div>
                )
              )}

              {isCurrent && (
                <div className="absolute -top-3 right-6">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-3 py-0.5 text-[10px] font-extrabold tracking-wider text-white uppercase shadow-sm">
                    Current Plan
                  </span>
                </div>
              )}

              <div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                  <p className="min-h-[32px] text-xs text-muted-foreground">{plan.description}</p>
                </div>

                {/* Price Display */}
                <div className="my-5 border-y border-border py-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-foreground">
                      {isTrial ? "₹0" : `₹${plan.monthlyPrice}`}
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {isTrial ? "/ 30 days" : "/ month"}
                    </span>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary-ink">
                      {plan.includedGSTINs} client GSTINs
                    </span>
                    <span className="inline-flex items-center rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      Unlimited GSTR-1
                    </span>
                  </div>
                </div>

                {/* Features List */}
                <div className="space-y-2.5 text-xs">
                  <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                    {isComingSoon ? "Planned for this tier" : "Everything, in every plan"}
                  </p>
                  <ul className="space-y-2">
                    {plan.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-foreground/90">
                        <Check className="mt-0.5 size-3.5 flex-shrink-0 text-emerald-500" />
                        <span>{feat}</span>
                      </li>
                    ))}
                    {!isTrial && (
                      <li className="flex items-start gap-2 font-medium text-primary-ink">
                        <Check className="mt-0.5 size-3.5 flex-shrink-0 text-primary-ink" />
                        <span>Extra GSTINs @ ₹6/month each</span>
                      </li>
                    )}
                  </ul>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-8 border-t border-border pt-4">
                {isComingSoon ? (
                  <button
                    type="button"
                    disabled
                    className="flex w-full cursor-default items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-muted/40 py-2.5 text-xs font-bold text-muted-foreground"
                  >
                    <Clock className="size-3.5" /> Coming soon
                  </button>
                ) : isCurrent ? (
                  <button
                    type="button"
                    disabled
                    className="flex w-full cursor-default items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2.5 text-xs font-bold text-emerald-600 opacity-90 dark:text-emerald-400"
                  >
                    <ShieldCheck className="size-3.5" /> Active Plan
                  </button>
                ) : isScheduled ? (
                  <button
                    type="button"
                    disabled
                    className="flex w-full cursor-default items-center justify-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 py-2.5 text-xs font-bold text-amber-600 opacity-90"
                  >
                    <Clock className="size-3.5" /> Scheduled for Renewal
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSelectPlan(plan.slug)}
                    disabled={pending || isTrial}
                    className={`flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition active:scale-98 disabled:opacity-50 ${
                      isPopular
                        ? "brand-gradient text-white shadow hover:brightness-110"
                        : "border border-border bg-background text-foreground hover:border-primary/40 hover:bg-accent"
                    }`}
                  >
                    {pending && selectedSlug === plan.slug ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <>
                        <span>{isTrial ? "Trial Included" : "Select & Upgrade"}</span>
                        <ArrowRight className="size-3" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
