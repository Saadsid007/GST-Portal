import prisma from "@/lib/prisma";
import { calculateBonus } from "@/features/billing/domain/bonus-calculator";
import { billingLogger } from "@/features/billing/services/billing.logger";
import { getPricingConfig } from "@/features/billing/services/config.service";
import { createRazorpayOrder } from "@/features/billing/services/razorpay.service";
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
  razorpayOrderId: string;
  razorpayPaymentId: string;
  eventId: string;
}): Promise<SettlementResult> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.rechargeOrder.findUnique({
      where: { razorpayOrderId: input.razorpayOrderId },
    });
    if (!order) {
      throw new Error(`Unknown Razorpay order ${input.razorpayOrderId}`);
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

export async function markRechargeFailed(razorpayOrderId: string): Promise<void> {
  await prisma.rechargeOrder.updateMany({
    where: { razorpayOrderId, status: "CREATED" },
    data: { status: "FAILED" },
  });
}
