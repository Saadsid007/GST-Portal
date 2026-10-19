/**
 * UPI QR purchase for plans and GSTIN capacity.
 *
 * Preferred over the hosted checkout page: a fixed-amount QR is one scan and one
 * approval in the user's own UPI app, with no redirect, no card form and no
 * third-party page to trust. `fixed_amount` + `single_use` on the Razorpay QR
 * are what make that safe — the payer cannot alter the amount and the code
 * cannot be paid twice.
 *
 * Same integrity model as the checkout path: what was ordered is written to a
 * CREATED Payment row here, and settlement reads plan, quantity and price back
 * from that row. Nothing about the purchase is ever taken from the client.
 */

import prisma from "@/lib/prisma";
import {
  getPlanDefinition,
  isPurchasable,
  ADDITIONAL_GSTIN_PRICE_MONTHLY,
  type PlanSlug,
} from "@/features/billing/config/pricing.config";
import {
  createUpiQrCode,
  fetchQrPayments,
  QR_TTL_SECONDS,
  type CreatedQrCode,
} from "@/features/billing/services/razorpay.service";
import { debitWallet } from "@/features/billing/services/wallet.service";
import { settleReferralOnFirstRecharge } from "@/features/billing/services/referral.service";
import {
  activatePaidPlan,
  getOrCreateSubscription,
} from "@/features/billing/services/subscription.service";
import {
  addGstinCapacity,
  calculateGstinAddonProration,
} from "@/features/billing/services/capacity.service";
import { billingLogger } from "@/features/billing/services/billing.logger";

export interface PurchaseQr {
  /** "wallet" when the credits covered the whole price and nothing is left to scan. */
  kind: "qr" | "wallet";
  qrCodeId: string;
  /** Razorpay-hosted PNG. Rendered directly; never proxied. Empty for "wallet". */
  imageUrl: string;
  /** Rupees to pay by UPI, after credits. */
  amount: number;
  /** Price before credits. */
  listPrice: number;
  /** Wallet credits (1 credit = ₹1) taken off the price. */
  creditsApplied: number;
  /** Unix seconds. The QR stops accepting payment after this. */
  closeBy: number;
  /** What the user is buying, for the dialog to restate before they scan. */
  summary: string;
}

/** A hold on credits outlives its QR by a margin, so a late payment still finds them. */
const QR_RESERVATION_MS = (QR_TTL_SECONDS + 10 * 60) * 1000;

interface PurchaseMeta {
  method?: string;
  quantity?: number;
  walletCredits?: number;
  listPrice?: number;
}

/**
 * Credits the user can put toward a new purchase now.
 *
 * Credits promised to a QR that is still open are held back, so two tabs
 * cannot spend one balance twice. A QR that lapsed releases its hold.
 */
async function spendableCredits(userId: string): Promise<number> {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet || wallet.isFrozen || wallet.balance <= 0) return 0;
  const open = await prisma.payment.findMany({
    where: {
      userId,
      status: "CREATED",
      providerQrCodeId: { not: null },
      createdAt: { gt: new Date(Date.now() - QR_RESERVATION_MS) },
    },
    select: { metadata: true },
  });
  const held = open.reduce(
    (sum, p) => sum + (Number((p.metadata as PurchaseMeta | null)?.walletCredits) || 0),
    0
  );
  return Math.max(0, wallet.balance - held);
}

interface Order {
  userId: string;
  listPrice: number;
  paymentType: "SUBSCRIPTION" | "ADDITIONAL_GSTIN";
  planSlug?: string;
  description: string;
  notes: Record<string, string>;
  meta: Record<string, string | number>;
  summary: string;
}

/**
 * One purchase, paid with wallet credits first and UPI for the rest.
 *
 * 1 credit = ₹1, on every plan, renewal and add-on until the balance is used
 * up. Credits are only reserved here; they leave the wallet when the purchase
 * settles, so an abandoned QR costs nothing. When the credits cover the whole
 * price there is nothing to scan and the purchase settles at once.
 */
async function startPurchase(order: Order): Promise<PurchaseQr> {
  const credits = Math.min(await spendableCredits(order.userId), order.listPrice);
  const toPay = order.listPrice - credits;
  const meta = { ...order.meta, walletCredits: credits, listPrice: order.listPrice };

  if (toPay <= 0) {
    const row = await prisma.payment.create({
      data: {
        userId: order.userId,
        provider: "WALLET",
        amount: 0,
        currency: "INR",
        status: "CREATED",
        paymentType: order.paymentType,
        planSlug: order.planSlug ?? null,
        metadata: { ...meta, method: "WALLET" },
      },
    });
    await fulfil(row.id, `wallet_${row.id}`);
    return {
      kind: "wallet",
      qrCodeId: row.id,
      imageUrl: "",
      amount: 0,
      listPrice: order.listPrice,
      creditsApplied: credits,
      closeBy: 0,
      summary: order.summary,
    };
  }

  const qr: CreatedQrCode = await createUpiQrCode({
    amountRupees: toPay,
    description: order.description,
    notes: { ...order.notes, walletCredits: String(credits) },
  });
  await prisma.payment.create({
    data: {
      userId: order.userId,
      provider: "RAZORPAY",
      providerQrCodeId: qr.qrCodeId,
      amount: toPay,
      currency: "INR",
      status: "CREATED",
      paymentType: order.paymentType,
      planSlug: order.planSlug ?? null,
      metadata: meta,
    },
  });
  billingLogger.info(
    { userId: order.userId, type: order.paymentType, qrCodeId: qr.qrCodeId, credits, toPay },
    "Purchase UPI QR created"
  );
  return {
    kind: "qr",
    qrCodeId: qr.qrCodeId,
    imageUrl: qr.imageUrl,
    amount: toPay,
    listPrice: order.listPrice,
    creditsApplied: credits,
    closeBy: qr.closeBy,
    summary: order.summary,
  };
}

/** Starts the purchase of a plan subscription. */
export async function createPlanQr(userId: string, planSlug: PlanSlug): Promise<PurchaseQr> {
  const plan = getPlanDefinition(planSlug);

  // Same gate as checkout: a coming-soon tier is not sellable by any route.
  if (!isPurchasable(plan.slug)) {
    throw new Error(
      plan.comingSoon === true
        ? `${plan.name} is not available yet.`
        : "This plan cannot be purchased."
    );
  }

  return startPurchase({
    userId,
    listPrice: plan.monthlyPrice,
    paymentType: "SUBSCRIPTION",
    planSlug: plan.slug,
    description: `GSTPilot ${plan.name} — ${plan.includedGSTINs} GSTINs`,
    notes: { userId, planSlug: plan.slug, type: "SUBSCRIPTION" },
    meta: { method: "UPI_QR", planName: plan.name },
    summary: `${plan.name} · ${plan.includedGSTINs} client GSTINs · 30 days`,
  });
}

/** Starts the purchase of extra GSTIN capacity, priced by proration. */
export async function createGstinAddonQr(userId: string, quantity: number): Promise<PurchaseQr> {
  const proration = await calculateGstinAddonProration(userId, quantity);
  return startPurchase({
    userId,
    listPrice: proration.proratedAmount,
    paymentType: "ADDITIONAL_GSTIN",
    description: `GSTPilot — ${proration.quantity} extra GSTIN slots`,
    notes: { userId, quantity: String(proration.quantity), type: "ADDITIONAL_GSTIN" },
    meta: { method: "UPI_QR", quantity: proration.quantity },
    summary: `${proration.quantity} extra GSTIN slot${proration.quantity === 1 ? "" : "s"} · prorated for ${proration.remainingDays} remaining days`,
  });
}

export type PurchaseQrState = { state: "pending" } | { state: "paid"; summary: string };

/**
 * Grants what a Payment row paid for, and spends its reserved credits.
 *
 * The row is claimed CREATED → SUCCESS first, so the webhook and the poller
 * cannot both grant it, and then completed in place. If granting fails the
 * claim is released, so the next poll or webhook retries — a paid purchase is
 * never left marked done but undelivered.
 */
async function fulfil(paymentRowId: string, providerPaymentId: string): Promise<void> {
  const claim = await prisma.payment.updateMany({
    where: { id: paymentRowId, status: "CREATED" },
    data: { status: "SUCCESS", providerPaymentId },
  });
  if (claim.count === 0) return; // another path settled it

  const order = await prisma.payment.findUniqueOrThrow({ where: { id: paymentRowId } });
  const meta = (order.metadata ?? {}) as PurchaseMeta;
  try {
    if (order.paymentType === "SUBSCRIPTION") {
      await activatePaidPlan({
        userId: order.userId,
        planSlug: (order.planSlug ?? "starter") as PlanSlug,
        paymentId: providerPaymentId,
        paymentRecordId: order.id,
        amountRupees: order.amount,
      });
    } else {
      const quantity = Number(meta.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new Error("Order is missing a valid quantity.");
      }
      await addGstinCapacity({
        userId: order.userId,
        quantity,
        amountRupees: order.amount,
        paymentId: providerPaymentId,
        paymentRecordId: order.id,
      });
    }
  } catch (error) {
    await prisma.payment.updateMany({
      where: { id: order.id, status: "SUCCESS" },
      data: { status: "CREATED", providerPaymentId: null },
    });
    billingLogger.error({ paymentRowId, err: error }, "Purchase grant failed; claim released");
    throw error;
  }

  await spendCredits(order.userId, order.id, Number(meta.walletCredits) || 0);
  await rewardReferralOnFirstPurchase(order.userId, order.id);
}

async function spendCredits(userId: string, paymentRowId: string, credits: number) {
  if (credits <= 0) return;
  try {
    await debitWallet({
      userId,
      credits,
      type: "PURCHASE",
      description: "Credits used toward a plan or GSTIN purchase",
      referenceId: paymentRowId,
    });
  } catch (error) {
    // The purchase is already granted, and the reservation made this unlikely.
    // What could not be taken is logged for review rather than undoing a sale.
    billingLogger.error(
      { userId, paymentRowId, credits, err: error },
      "Could not spend reserved credits"
    );
  }
}

/**
 * Referral rewards follow the referee's first paid purchase. They followed the
 * first wallet recharge — a screen the app no longer offers — so no referral
 * could ever pay out.
 */
async function rewardReferralOnFirstPurchase(userId: string, paymentRowId: string) {
  const [earlier, current] = await Promise.all([
    prisma.payment.count({
      where: { userId, status: "SUCCESS", id: { not: paymentRowId }, amount: { gt: 0 } },
    }),
    prisma.payment.findUnique({ where: { id: paymentRowId }, select: { amount: true } }),
  ]);
  if (earlier > 0 || !current || current.amount <= 0) return;
  try {
    await prisma.$transaction((tx) => settleReferralOnFirstRecharge(tx, userId, true));
  } catch (error) {
    billingLogger.error({ userId, err: error }, "Referral reward failed");
  }
}

/**
 * Settles a QR purchase once Razorpay reports a captured payment against it.
 * Called by the dialog's poll and by the webhook; whichever arrives first
 * grants it, and the other finds the row already settled.
 */
export async function settlePurchaseQr(userId: string, qrCodeId: string): Promise<PurchaseQrState> {
  const order = await prisma.payment.findFirst({
    // Scoped to the caller: a QR id must never settle someone else's purchase.
    where: { providerQrCodeId: qrCodeId, userId },
  });
  if (!order) throw new Error("Unknown payment");

  if (order.status === "SUCCESS") {
    return { state: "paid", summary: describe(order.paymentType, order.planSlug) };
  }

  const payments = await fetchQrPayments(qrCodeId);
  const captured = payments.find((p) => p.status === "captured");
  if (!captured) return { state: "pending" };

  await fulfil(order.id, captured.id);
  billingLogger.info({ userId, qrCodeId, type: order.paymentType }, "UPI QR purchase settled");
  return { state: "paid", summary: describe(order.paymentType, order.planSlug) };
}

function describe(paymentType: string, planSlug: string | null): string {
  if (paymentType === "SUBSCRIPTION") {
    return `${getPlanDefinition(planSlug ?? "starter").name} activated`;
  }
  return "Extra GSTIN capacity added";
}

/** Current plan price and capacity, for the add-on dialog's summary line. */
export async function getAddonContext(userId: string) {
  const sub = await getOrCreateSubscription(userId);
  return { pricePerGstin: ADDITIONAL_GSTIN_PRICE_MONTHLY, cycleEnd: sub.endDate };
}
