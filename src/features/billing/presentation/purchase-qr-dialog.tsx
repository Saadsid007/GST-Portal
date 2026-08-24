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
} from "lucide-react";
import { Button, Modal, Spinner } from "@/components/ui";
import {
  createGstinAddonQrOrderAction,
  createPlanQrOrderAction,
  getPurchaseQrStatusAction,
} from "@/features/billing/actions/billing.actions";
import type { PurchaseQr } from "@/features/billing/services/subscription-qr.service";
import type { PlanSlug } from "@/features/billing/config/pricing.config";
import { UpiQrImage } from "@/features/billing/presentation/upi-qr-image";

const POLL_MS = 3000;

/** What is being bought. The dialog is identical either way past creation. */
export type PurchaseIntent =
  | { kind: "plan"; planSlug: PlanSlug; planName: string }
  | { kind: "gstin-addon"; quantity: number };

type Phase =
  | { state: "creating" }
  | { state: "awaiting"; qr: PurchaseQr }
  | { state: "paid"; summary: string }
  | { state: "expired" }
  | { state: "error"; message: string };

/**
 * Scan-and-pay purchase, replacing the hosted checkout page.
 *
 * A fixed-amount UPI QR is a shorter path than a redirect to a card form: the
 * user stays in the app, approves in whichever UPI app they already trust, and
 * this screen settles itself the moment the payment lands. The webhook remains
 * authoritative — the poll only exists so the user is not left staring at a
 * spinner waiting on delivery.
 */
export function PurchaseQrDialog({
  intent,
  onClose,
  onSuccess,
}: {
  intent: PurchaseIntent;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ state: "creating" });
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  // Guards against a poll resolving after the dialog is gone.
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Create the QR once, on open.
  const intentKey = intent.kind === "plan" ? `plan:${intent.planSlug}` : `addon:${intent.quantity}`;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result =
        intent.kind === "plan"
          ? await createPlanQrOrderAction(intent.planSlug)
          : await createGstinAddonQrOrderAction(intent.quantity);

      if (cancelled || !alive.current) return;
      if (result.success && result.data) {
        setPhase({ state: "awaiting", qr: result.data });
      } else {
        setPhase({ state: "error", message: result.error ?? "Could not generate the QR code." });
      }
    })();
    return () => {
      cancelled = true;
    };
    // Keyed on the intent, not the object identity, so a re-render does not
    // mint a second QR for the same purchase.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intentKey]);

  const qrCodeId = phase.state === "awaiting" ? phase.qr.qrCodeId : null;
  const closeBy = phase.state === "awaiting" ? phase.qr.closeBy : null;
  const amount = phase.state === "awaiting" ? phase.qr.amount : null;

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

  // Poll until paid.
  useEffect(() => {
    if (!qrCodeId) return;
    const id = setInterval(async () => {
      const result = await getPurchaseQrStatusAction(qrCodeId);
      if (!alive.current || !result.success || !result.data) return;

      if (result.data.state === "paid") {
        clearInterval(id);
        setPhase({ state: "paid", summary: result.data.summary });
        toast.success(result.data.summary);
        router.refresh();
        onSuccess?.();
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [qrCodeId, router, onSuccess]);

  const handleClose = useCallback(() => {
    alive.current = false;
    onClose();
  }, [onClose]);

  const mmss =
    secondsLeft === null
      ? null
      : `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}`;

  const title = amount === null ? "Pay by UPI" : `Pay ₹${amount.toLocaleString("en-IN")} by UPI`;

  return (
    <Modal
      open
      onClose={handleClose}
      size="md"
      icon={<Smartphone className="size-4 text-primary-ink" aria-hidden />}
      title={title}
      footer={
        phase.state === "awaiting" ? (
          <p className="w-full text-center text-2xs text-muted-foreground">
            Keep this open — it activates the moment your payment lands
          </p>
        ) : undefined
      }
    >
      <div className="p-6">
        {phase.state === "creating" && (
          <div className="flex flex-col items-center gap-3 py-14">
            <Spinner size="lg" />
            <p className="text-sm text-muted-foreground">Generating your QR code…</p>
          </div>
        )}

        {phase.state === "awaiting" && (
          <div className="space-y-5 text-center">
            {/* Amount and what it buys, before anything is scanned. */}
            <div>
              <p className="text-3xl font-bold tracking-tight tabular-nums">
                ₹{phase.qr.amount.toLocaleString("en-IN")}
              </p>
              <p className="mt-1 text-xs font-medium text-foreground">{phase.qr.summary}</p>
              <p className="mt-0.5 text-2xs text-muted-foreground">
                Locked to this QR — the amount cannot be changed
              </p>
            </div>

            <UpiQrImage imageUrl={phase.qr.imageUrl} amount={phase.qr.amount} />

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

            {/* The QR is cropped out of a Razorpay poster whose layout we do not
                control, so there is always a way to reach the original. */}
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
              <p className="mt-1 text-sm text-muted-foreground">{phase.summary}.</p>
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
    </Modal>
  );
}
