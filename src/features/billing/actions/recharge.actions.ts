"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/features/auth";
import { calculateBonus } from "@/features/billing/domain/bonus-calculator";
import { billingLogger } from "@/features/billing/services/billing.logger";
import { getPricingConfig } from "@/features/billing/services/config.service";
import {
  fetchQrPayments,
  verifyCheckoutSignature,
} from "@/features/billing/services/razorpay.service";
import {
  createQrRecharge,
  createRecharge,
  markRechargeFailed,
  priceRecharge,
  settleRecharge,
  type QrRecharge,
  type SettlementResult,
} from "@/features/billing/services/recharge.service";
import prisma from "@/lib/prisma";
import { rechargeSchema, verifyPaymentSchema } from "@/features/billing/schemas/billing.schemas";
import type {
  ActionResult,
  BonusBreakdown,
  RechargePack,
} from "@/features/billing/types/billing.types";

/** Live packs plus the slab-priced bonus for each, so the dialog never hardcodes pricing. */
export async function getRechargeOptionsAction(): Promise<
  ActionResult<{ packs: (RechargePack & { breakdown: BonusBreakdown })[]; generationCost: number }>
> {
  await requireSession();
  const { packs, slabs, campaign, generationCost } = await getPricingConfig();

  return {
    success: true,
    data: {
      packs: packs.map((pack) => ({
        ...pack,
        breakdown: calculateBonus(pack.amount, slabs, campaign),
      })),
      generationCost,
    },
  };
}

/** Realtime preview for the custom-amount field. Priced by the same code the order uses. */
export async function previewRechargeAction(amount: number): Promise<ActionResult<BonusBreakdown>> {
  await requireSession();
  const parsed = rechargeSchema.safeParse({ amount });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid amount" };
  }
  return { success: true, data: await priceRecharge(parsed.data.amount) };
}

export async function createRechargeOrderAction(
  amount: number
): Promise<
  ActionResult<{ orderId: string; amountPaise: number; keyId: string; breakdown: BonusBreakdown }>
> {
  const session = await requireSession();
  const parsed = rechargeSchema.safeParse({ amount });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid amount" };
  }

  try {
    return { success: true, data: await createRecharge(session.user.id, parsed.data.amount) };
  } catch (error) {
    billingLogger.error({ userId: session.user.id, err: error }, "Could not create recharge order");
    return { success: false, error: "Could not start the payment. Please try again." };
  }
}

/**
 * The fast settlement path, driven by Razorpay Checkout's callback. The webhook
 * remains authoritative; both converge on the same idempotent `settleRecharge`,
 * so whichever arrives first credits and the other is a no-op.
 */
export async function verifyPaymentAction(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): Promise<ActionResult<SettlementResult>> {
  await requireSession();
  const parsed = verifyPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid payment response" };
  }

  const valid = verifyCheckoutSignature({
    orderId: parsed.data.razorpayOrderId,
    paymentId: parsed.data.razorpayPaymentId,
    signature: parsed.data.razorpaySignature,
  });
  if (!valid) {
    billingLogger.warn({ orderId: parsed.data.razorpayOrderId }, "Checkout signature mismatch");
    await markRechargeFailed({ razorpayOrderId: parsed.data.razorpayOrderId });
    return { success: false, error: "Payment could not be verified." };
  }

  const result = await settleRecharge({
    razorpayOrderId: parsed.data.razorpayOrderId,
    razorpayPaymentId: parsed.data.razorpayPaymentId,
    eventId: `checkout:${parsed.data.razorpayPaymentId}`,
  });

  revalidatePath("/billing");
  revalidatePath("/dashboard");
  return { success: true, data: result };
}

/* ── UPI QR ─────────────────────────────────────────────────────────────── */

/** Generates a fixed-amount UPI QR for the given recharge. */
export async function createQrRechargeAction(amount: number): Promise<ActionResult<QrRecharge>> {
  const session = await requireSession();
  const parsed = rechargeSchema.safeParse({ amount });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid amount" };
  }

  try {
    return { success: true, data: await createQrRecharge(session.user.id, parsed.data.amount) };
  } catch (error) {
    billingLogger.error({ userId: session.user.id, err: error }, "Could not create UPI QR");
    return { success: false, error: "Could not generate the QR code. Please try again." };
  }
}

export type QrStatus =
  | { state: "pending" }
  | { state: "expired" }
  | { state: "paid"; totalCredits: number; balanceAfter: number };

/**
 * Polled by the QR screen while the user pays.
 *
 * The webhook remains the authoritative settlement path; this exists so the
 * screen updates in a second or two rather than whenever delivery happens. Both
 * converge on the same idempotent `settleRecharge`, so whichever wins credits
 * exactly once.
 */
export async function getQrRechargeStatusAction(qrCodeId: string): Promise<ActionResult<QrStatus>> {
  const session = await requireSession();

  // Scoped to the caller: a QR id must never reveal another user's recharge.
  const order = await prisma.rechargeOrder.findFirst({
    where: { razorpayQrCodeId: qrCodeId, userId: session.user.id },
  });
  if (!order) return { success: false, error: "Unknown payment" };

  if (order.status === "PAID") {
    const wallet = await prisma.wallet.findUnique({ where: { userId: session.user.id } });
    return {
      success: true,
      data: {
        state: "paid",
        totalCredits: order.totalCredits,
        balanceAfter: wallet?.balance ?? 0,
      },
    };
  }

  try {
    const payments = await fetchQrPayments(qrCodeId);
    const captured = payments.find((p) => p.status === "captured");

    if (captured) {
      const result = await settleRecharge({
        razorpayQrCodeId: qrCodeId,
        razorpayPaymentId: captured.id,
        eventId: `qr:${captured.id}`,
      });
      revalidatePath("/billing");
      revalidatePath("/dashboard");
      return {
        success: true,
        data: {
          state: "paid",
          totalCredits: result.totalCredits,
          balanceAfter: result.balanceAfter,
        },
      };
    }
  } catch (error) {
    // A polling failure is not a payment failure — stay pending and let the
    // next tick (or the webhook) resolve it.
    billingLogger.warn({ qrCodeId, err: error }, "QR status poll failed");
  }

  return { success: true, data: { state: "pending" } };
}
