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
  type CreatedQrCode,
} from "@/features/billing/services/razorpay.service";
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
  qrCodeId: string;
  /** Razorpay-hosted PNG. Rendered directly; never proxied. */
  imageUrl: string;
  amount: number;
  /** Unix seconds. The QR stops accepting payment after this. */
  closeBy: number;
  /** What the user is buying, for the dialog to restate before they scan. */
  summary: string;
}

/** Creates a fixed-amount QR for a plan subscription. */
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

  const qr: CreatedQrCode = await createUpiQrCode({
    amountRupees: plan.monthlyPrice,
    description: `GSTPilot ${plan.name} — ${plan.includedGSTINs} GSTINs`,
    notes: { userId, planSlug: plan.slug, type: "SUBSCRIPTION" },
  });

  await prisma.payment.create({
    data: {
      userId,
      provider: "RAZORPAY",
      providerQrCodeId: qr.qrCodeId,
      amount: plan.monthlyPrice,
      currency: "INR",
      status: "CREATED",
      paymentType: "SUBSCRIPTION",
      planSlug: plan.slug,
      metadata: { method: "UPI_QR", planName: plan.name },
    },
  });

  billingLogger.info({ userId, planSlug: plan.slug, qrCodeId: qr.qrCodeId }, "Plan UPI QR created");

  return {
    qrCodeId: qr.qrCodeId,
    imageUrl: qr.imageUrl,
    amount: plan.monthlyPrice,
    closeBy: qr.closeBy,
    summary: `${plan.name} · ${plan.includedGSTINs} client GSTINs · 30 days`,
  };
}

/** Creates a fixed-amount QR for extra GSTIN capacity, priced by proration. */
export async function createGstinAddonQr(userId: string, quantity: number): Promise<PurchaseQr> {
  const proration = await calculateGstinAddonProration(userId, quantity);

  const qr: CreatedQrCode = await createUpiQrCode({
    amountRupees: proration.proratedAmount,
    description: `GSTPilot — ${proration.quantity} extra GSTIN slots`,
    notes: {
      userId,
      quantity: String(proration.quantity),
      type: "ADDITIONAL_GSTIN",
    },
  });

  await prisma.payment.create({
    data: {
      userId,
      provider: "RAZORPAY",
      providerQrCodeId: qr.qrCodeId,
      amount: proration.proratedAmount,
      currency: "INR",
      status: "CREATED",
      paymentType: "ADDITIONAL_GSTIN",
      metadata: { method: "UPI_QR", quantity: proration.quantity },
    },
  });

  billingLogger.info(
    { userId, quantity: proration.quantity, qrCodeId: qr.qrCodeId },
    "GSTIN add-on UPI QR created"
  );

  return {
    qrCodeId: qr.qrCodeId,
    imageUrl: qr.imageUrl,
    amount: proration.proratedAmount,
    closeBy: qr.closeBy,
    summary: `${proration.quantity} extra GSTIN slot${proration.quantity === 1 ? "" : "s"} · prorated for ${proration.remainingDays} remaining days`,
  };
}

export type PurchaseQrState = { state: "pending" } | { state: "paid"; summary: string };

/**
 * Settles a QR purchase once Razorpay reports a captured payment against it.
 *
 * Idempotent by construction: the Payment row moves CREATED → SUCCESS in a
 * conditional update, so whichever of the webhook or the poller gets there first
 * performs the entitlement change and the loser sees an already-settled row.
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

  // Claim the row before granting anything. A zero count means another path
  // already settled it, so this one must not apply the entitlement twice.
  const claim = await prisma.payment.updateMany({
    where: { id: order.id, status: "CREATED" },
    data: { status: "SUCCESS", providerPaymentId: captured.id },
  });
  if (claim.count === 0) {
    return { state: "paid", summary: describe(order.paymentType, order.planSlug) };
  }

  if (order.paymentType === "SUBSCRIPTION") {
    await activatePaidPlan({
      userId,
      planSlug: (order.planSlug ?? "starter") as PlanSlug,
      paymentId: captured.id,
      amountRupees: order.amount,
    });
  } else {
    const meta = (order.metadata ?? {}) as { quantity?: number };
    const quantity = Number(meta.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error("Order is missing a valid quantity.");
    }
    await addGstinCapacity({
      userId,
      quantity,
      amountRupees: order.amount,
      paymentId: captured.id,
    });
  }

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
