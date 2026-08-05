"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, QrCode, Sparkles } from "lucide-react";
import {
  getRechargeOptionsAction,
  previewRechargeAction,
} from "@/features/billing/actions/recharge.actions";
import { Button } from "@/components/ui";
import { UpiQrDialog } from "@/features/billing/presentation/upi-qr-dialog";
import {
  MAX_RECHARGE_AMOUNT,
  MIN_RECHARGE_AMOUNT,
} from "@/features/billing/constants/billing.constants";
import type { BonusBreakdown, RechargePack } from "@/features/billing/types/billing.types";

type Pack = RechargePack & { breakdown: BonusBreakdown };

export function RechargePanel() {
  const router = useRouter();
  const [packs, setPacks] = useState<Pack[]>([]);
  const [generationCost, setGenerationCost] = useState(6);
  const [custom, setCustom] = useState("");
  const [preview, setPreview] = useState<BonusBreakdown | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  /** Non-null while the UPI QR dialog is open. */
  const [qrAmount, setQrAmount] = useState<number | null>(null);

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
    // The QR itself is created inside the dialog, so the button stays instant
    // and any Razorpay latency is shown against a real surface.
    setQrAmount(activeAmount);
  }

  return (
    <div className="space-y-5">
      {qrAmount !== null && (
        <UpiQrDialog
          amount={qrAmount}
          onClose={() => {
            setQrAmount(null);
            setCustom("");
            router.refresh();
          }}
        />
      )}

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
                <span className="absolute -top-2 right-3 rounded-full bg-warning px-2 py-0.5 text-[10px] font-bold tracking-wide text-warning-foreground uppercase">
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
                  <span className="font-semibold text-success">
                    {" "}
                    (+{pack.breakdown.bonusCredits} bonus)
                  </span>
                )}
              </p>
              <p className="text-[11px] text-muted-foreground">
                ≈ {Math.floor(pack.breakdown.totalCredits / generationCost)} returns
              </p>
              {isActive && <Check className="absolute right-3 bottom-3 size-4 text-primary-ink" />}
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
              <p className="text-sm font-bold text-success">
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
          <p className="flex items-center gap-1.5 text-xs font-semibold text-warning">
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

      <Button
        variant="brand"
        size="xl"
        block
        onClick={handleRecharge}
        disabled={!activeAmount || !activeBreakdown}
      >
        <QrCode />
        {activeBreakdown
          ? `Pay ₹${activeBreakdown.amount.toLocaleString("en-IN")} by UPI · get ${activeBreakdown.totalCredits.toLocaleString("en-IN")} credits`
          : "Select an amount"}
      </Button>

      <p className="text-center text-2xs text-muted-foreground">
        Scan the QR with any UPI app. No card details, no redirect.
      </p>
    </div>
  );
}
