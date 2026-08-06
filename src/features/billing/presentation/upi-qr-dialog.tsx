"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  X,
} from "lucide-react";
import { Badge, Button, Spinner } from "@/components/ui";
import {
  createQrRechargeAction,
  getQrRechargeStatusAction,
} from "@/features/billing/actions/recharge.actions";
import type { QrRecharge } from "@/features/billing/services/recharge.service";
import { UpiQrImage } from "@/features/billing/presentation/upi-qr-image";
import { cn } from "@/lib/utils";

const POLL_MS = 3000;

type Phase =
  | { state: "creating" }
  | { state: "awaiting"; qr: QrRecharge }
  | { state: "paid"; credits: number; balance: number }
  | { state: "expired" }
  | { state: "error"; message: string };

export function UpiQrDialog({ amount, onClose }: { amount: number; onClose: () => void }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ state: "creating" });
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  // Guards against a poll that resolves after the dialog is gone.
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Create the QR once, on open.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await createQrRechargeAction(amount);
      if (cancelled || !alive.current) return;
      if (result.success) {
        setPhase({ state: "awaiting", qr: result.data });
      } else {
        setPhase({ state: "error", message: result.error });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [amount]);

  const qrCodeId = phase.state === "awaiting" ? phase.qr.qrCodeId : null;
  const closeBy = phase.state === "awaiting" ? phase.qr.closeBy : null;

  // Countdown to QR expiry.
  useEffect(() => {
    if (closeBy === null) return;
    const tick = () => {
      const left = closeBy - Math.floor(Date.now() / 1000);
      setSecondsLeft(Math.max(left, 0));
      if (left <= 0) setPhase({ state: "expired" });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [closeBy]);

  // Poll until paid. The webhook is authoritative; this keeps the screen honest.
  useEffect(() => {
    if (!qrCodeId) return;
    const id = setInterval(async () => {
      const result = await getQrRechargeStatusAction(qrCodeId);
      if (!alive.current || !result.success) return;

      if (result.data.state === "paid") {
        clearInterval(id);
        setPhase({
          state: "paid",
          credits: result.data.totalCredits,
          balance: result.data.balanceAfter,
        });
        toast.success(`${result.data.totalCredits} credits added to your wallet`);
        router.refresh();
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [qrCodeId, router]);

  const handleClose = useCallback(() => {
    alive.current = false;
    onClose();
  }, [onClose]);

  // Escape closes, and the page behind must not scroll under the dialog.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [handleClose]);

  const mmss =
    secondsLeft === null
      ? null
      : `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(
          secondsLeft % 60
        ).padStart(2, "0")}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Pay by UPI"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md animate-scale-in overflow-hidden rounded-2xl border border-border bg-popover shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Smartphone className="size-4 text-primary-ink" aria-hidden />
            <p className="text-sm font-semibold">Pay ₹{amount.toLocaleString("en-IN")} by UPI</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="p-6">
          {phase.state === "creating" && (
            <div className="flex flex-col items-center gap-3 py-14">
              <Spinner size="lg" />
              <p className="text-sm text-muted-foreground">Generating your QR code…</p>
            </div>
          )}

          {phase.state === "awaiting" && (
            <div className="space-y-5 text-center">
              {/* Amount leads: it is the one thing to confirm before scanning. */}
              <div>
                <p className="text-3xl font-bold tracking-tight tabular-nums">
                  ₹{amount.toLocaleString("en-IN")}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Locked to this QR — the amount cannot be changed
                </p>
              </div>

              <UpiQrImage imageUrl={phase.qr.imageUrl} amount={amount} />

              <div className="space-y-2">
                <p className="text-sm font-medium">Scan with any UPI app</p>
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  {["GPay", "PhonePe", "Paytm", "BHIM", "Bank app"].map((app) => (
                    <span
                      key={app}
                      className="rounded-md border border-border bg-card px-2 py-1 text-2xs font-medium text-muted-foreground"
                    >
                      {app}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 rounded-lg bg-muted px-3 py-2">
                <Spinner size="sm" />
                <span className="text-xs font-medium">Waiting for payment…</span>
                {mmss && (
                  <span className="ml-1 inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                    <Clock className="size-3" aria-hidden />
                    {mmss}
                  </span>
                )}
              </div>

              <dl className="space-y-1 rounded-lg border border-border p-3 text-xs">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Base credits</dt>
                  <dd className="font-semibold tabular-nums">{phase.qr.breakdown.baseCredits}</dd>
                </div>
                {phase.qr.breakdown.bonusCredits > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Bonus</dt>
                    <dd className="font-semibold text-success-ink tabular-nums">
                      +{phase.qr.breakdown.bonusCredits} ({phase.qr.breakdown.bonusPercent}%)
                    </dd>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-1">
                  <dt className="font-semibold">You receive</dt>
                  <dd className="font-bold tabular-nums">{phase.qr.breakdown.totalCredits}</dd>
                </div>
              </dl>

              {/* Escape hatch. The QR is cropped out of a Razorpay poster whose
                  layout we do not control, so there is always a way to reach
                  the original if the crop ever drifts. */}
              <a
                href={phase.qr.imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-2xs font-medium text-primary-ink underline underline-offset-2 hover:opacity-80"
              >
                <ExternalLink className="size-3" aria-hidden />
                Trouble scanning? Open the full QR
              </a>

              <p className="flex items-center justify-center gap-1.5 text-2xs text-muted-foreground">
                <ShieldCheck className="size-3" aria-hidden />
                Amount is locked to this QR and it can only be paid once
              </p>
            </div>
          )}

          {phase.state === "paid" && (
            <div className="space-y-4 py-6 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-success/12 text-success ring-1 ring-success/25">
                <CheckCircle2 className="size-7" aria-hidden />
              </div>
              <div>
                <p className="text-base font-semibold">Payment received</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {phase.credits} credits added. Your balance is now{" "}
                  <span className="font-semibold text-foreground tabular-nums">
                    {phase.balance.toLocaleString("en-IN")}
                  </span>
                  .
                </p>
              </div>
              <Button variant="brand" block onClick={handleClose}>
                Done
              </Button>
            </div>
          )}

          {phase.state === "expired" && (
            <div className="space-y-4 py-6 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-warning/12 text-warning-ink ring-1 ring-warning/25">
                <Clock className="size-7" aria-hidden />
              </div>
              <div>
                <p className="text-base font-semibold">This QR code expired</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  No money was taken. Generate a fresh one to continue.
                </p>
              </div>
              <Button variant="outline" block onClick={handleClose}>
                <RefreshCw />
                Start again
              </Button>
            </div>
          )}

          {phase.state === "error" && (
            <div className="space-y-4 py-6 text-center">
              <p className="text-sm font-semibold text-destructive-ink">{phase.message}</p>
              <Button variant="outline" block onClick={handleClose}>
                Close
              </Button>
            </div>
          )}
        </div>

        {phase.state === "awaiting" && (
          <div className="border-t border-border bg-subtle px-5 py-3">
            <Badge variant="neutral" className={cn("w-full justify-center")}>
              Keep this open — your wallet updates the moment payment lands
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
}
