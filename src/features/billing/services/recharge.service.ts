import prisma from "@/lib/prisma";
import { calculateBonus } from "@/features/billing/domain/bonus-calculator";
import { billingLogger } from "@/features/billing/services/billing.logger";
import { getPricingConfig } from "@/features/billing/services/config.service";
import {
  createRazorpayOrder,
  createUpiQrCode,
  type CreatedQrCode,
} from "@/features/billing/services/razorpay.service";
import { settleReferralOnFirstRecharge } from "@/features/billing/services/referral.service";
import { creditWallet, getOrCreateWallet } from "@/features/billing/services/wallet.service";
import type { BonusBreakdown } from "@/features/billing/types/billing.types";

/**
 * Recharge lifecycle: price → order → settle.
 *
 * Pricing always happens server-side from the live BillingConfig snapshot — the
 * amount the browser posts is validated, but the bonus it displayed is never
 * trusted. Settlement is idempotent: `RechargeOrder.webhookEventId` is a unique
 * column written in the same transaction that credits the wallet, so a replayed
 * webhook (or the checkout callback racing the webhook) credits exactly once.
 */

export async function priceRecharge(amount: number): Promise<BonusBreakdown> {
  const { slabs, campaign } = await getPricingConfig();
  return calculateBonus(amount, slabs, campaign);
}

export async function createRecharge(userId: string, amount: number) {
  const breakdown = await priceRecharge(amount);
  await getOrCreateWallet(userId);

  const order = await createRazorpayOrder(amount, `rcpt_${userId.slice(0, 8)}_${amount}`, {
    userId,
    credits: String(breakdown.totalCredits),
  });

  await prisma.rechargeOrder.create({
    data: {
      userId,
      method: "CHECKOUT",
      razorpayOrderId: order.orderId,
      amount,
      bonusCredits: breakdown.bonusCredits,
      totalCredits: breakdown.totalCredits,
      status: "CREATED",
    },
  });

  billingLogger.info({ userId, amount, orderId: order.orderId }, "Recharge order created");

  return { orderId: order.orderId, amountPaise: order.amountPaise, keyId: order.keyId, breakdown };
}

export interface SettlementResult {
  credited: boolean;
  totalCredits: number;
  balanceAfter: number;
}

/**
 * Credits the wallet for a paid order. Safe to call repeatedly and from both
 * settlement paths — the `eventId` write is the guard.
 *
 * The base amount and the bonus are two separate ledger rows on purpose: the
 * wallet's `lifetimeRecharged` must reflect rupees actually paid, while the
 * bonus rolls into `bonusEarned`. One combined row would conflate them.
 */
export async function settleRecharge(input: {
  /** Set for checkout payments. Exactly one locator must be provided. */
  razorpayOrderId?: string;
  /** Set for UPI QR payments — a QR code is not an order. */
  razorpayQrCodeId?: string;
  razorpayPaymentId: string;
  eventId: string;
}): Promise<SettlementResult> {
  if (!input.razorpayOrderId && !input.razorpayQrCodeId) {
    throw new Error("settleRecharge needs either a Razorpay order id or a QR code id");
  }

  return prisma.$transaction(async (tx) => {
    const order = input.razorpayOrderId
      ? await tx.rechargeOrder.findUnique({ where: { razorpayOrderId: input.razorpayOrderId } })
      : await tx.rechargeOrder.findUnique({
          where: { razorpayQrCodeId: input.razorpayQrCodeId! },
        });
    if (!order) {
      throw new Error(`Unknown recharge for ${input.razorpayOrderId ?? input.razorpayQrCodeId}`);
    }
    if (order.status === "PAID") {
      const wallet = await tx.wallet.findUnique({ where: { userId: order.userId } });
      return {
        credited: false,
        totalCredits: order.totalCredits,
        balanceAfter: wallet?.balance ?? 0,
      };
    }

    // Read before crediting: this is what decides whether a pending referral pays out.
    const walletBefore = await tx.wallet.findUnique({ where: { userId: order.userId } });
    const isFirstRecharge = (walletBefore?.lifetimeRecharged ?? 0) === 0;

    await tx.rechargeOrder.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        razorpayPaymentId: input.razorpayPaymentId,
        webhookEventId: input.eventId,
      },
    });

    const base = await creditWallet(
      {
        userId: order.userId,
        credits: order.amount,
        type: "RECHARGE",
        description: `Wallet recharge of ₹${order.amount}`,
        referenceId: order.id,
      },
      tx
    );

    let balanceAfter = base.balanceAfter;
    if (order.bonusCredits > 0) {
      const bonus = await creditWallet(
        {
          userId: order.userId,
          credits: order.bonusCredits,
          type: "BONUS",
          description: `Wallet bonus on ₹${order.amount} recharge`,
          referenceId: order.id,
        },
        tx
      );
      balanceAfter = bonus.balanceAfter;
    }

    await settleReferralOnFirstRecharge(tx, order.userId, isFirstRecharge);

    billingLogger.info(
      { userId: order.userId, orderId: order.razorpayOrderId, credits: order.totalCredits },
      "Recharge settled"
    );

    return { credited: true, totalCredits: order.totalCredits, balanceAfter };
  });
}

export async function markRechargeFailed(locator: {
  razorpayOrderId?: string;
  razorpayQrCodeId?: string;
}): Promise<void> {
  const where = locator.razorpayOrderId
    ? { razorpayOrderId: locator.razorpayOrderId, status: "CREATED" }
    : { razorpayQrCodeId: locator.razorpayQrCodeId, status: "CREATED" };
  await prisma.rechargeOrder.updateMany({ where, data: { status: "FAILED" } });
}

export interface QrRecharge {
  qrCodeId: string;
  imageUrl: string;
  amount: number;
  closeBy: number;
  breakdown: BonusBreakdown;
}

/**
 * Creates a fixed-amount UPI QR and the matching CREATED recharge row.
 *
 * Pricing is resolved server-side exactly as the checkout flow does, so the
 * credits a QR grants can never be influenced by what the browser displayed.
 */
export async function createQrRecharge(userId: string, amount: number): Promise<QrRecharge> {
  const breakdown = await priceRecharge(amount);
  await getOrCreateWallet(userId);

  const qr: CreatedQrCode = await createUpiQrCode({
    amountRupees: amount,
    description: `GSTPilot wallet recharge — ${breakdown.totalCredits} credits`,
    notes: { userId, credits: String(breakdown.totalCredits) },
  });

  await prisma.rechargeOrder.create({
    data: {
      userId,
      method: "UPI_QR",
      razorpayQrCodeId: qr.qrCodeId,
      amount,
      bonusCredits: breakdown.bonusCredits,
      totalCredits: breakdown.totalCredits,
      status: "CREATED",
    },
  });

  billingLogger.info({ userId, amount, qrCodeId: qr.qrCodeId }, "UPI QR recharge created");

  return {
    qrCodeId: qr.qrCodeId,
    imageUrl: qr.imageUrl,
    amount,
    closeBy: qr.closeBy,
    breakdown,
  };
}
