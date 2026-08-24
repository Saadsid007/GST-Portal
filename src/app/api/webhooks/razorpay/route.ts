import { NextResponse } from "next/server";
import { billingLogger } from "@/features/billing/services/billing.logger";
import { verifyWebhookSignature } from "@/features/billing/services/razorpay.service";
import { activatePaidPlan } from "@/features/billing/services/subscription.service";
import { addGstinCapacity } from "@/features/billing/services/capacity.service";
import { settlePurchaseQr } from "@/features/billing/services/subscription-qr.service";
import { settleRecharge } from "@/features/billing/services/recharge.service";
import type { PlanSlug } from "@/features/billing/config/pricing.config";
import prisma from "@/lib/prisma";

interface RazorpayWebhookPayload {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        amount?: number;
        currency?: string;
        status?: string;
        notes?: Record<string, string>;
      };
    };
    order?: {
      entity?: {
        id?: string;
        amount?: number;
        status?: string;
        notes?: Record<string, string>;
      };
    };
    qr_code?: {
      entity?: {
        id?: string;
        notes?: Record<string, string>;
      };
    };
  };
}

export async function POST(request: Request): Promise<NextResponse> {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!signature || !verifyWebhookSignature(rawBody, signature)) {
    billingLogger.warn("Rejected Razorpay webhook with invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let payload: RazorpayWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as RazorpayWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }

  const paymentEntity = payload.payload?.payment?.entity;
  const orderEntity = payload.payload?.order?.entity;

  const orderId = paymentEntity?.order_id ?? orderEntity?.id;
  const paymentId = paymentEntity?.id;
  const notes = paymentEntity?.notes ?? orderEntity?.notes ?? {};
  const amountPaise = paymentEntity?.amount ?? orderEntity?.amount ?? 0;
  const amountRupees = Math.round(amountPaise / 100);

  const eventId =
    request.headers.get("x-razorpay-event-id") ??
    `evt_${paymentId ?? orderId ?? Date.now().toString(36)}`;

  // 1. Idempotency check: process each event exactly once
  const existingEvent = await prisma.paymentEvent.findUnique({
    where: { eventId },
  });

  if (existingEvent) {
    billingLogger.info({ eventId }, "Webhook event already processed (idempotent skip)");
    return NextResponse.json({ received: true, idempotent: true });
  }

  const eventType = payload.event ?? "unknown";

  // UPI QR settlement. Without this the dialog's poll is the only thing that
  // finishes a purchase, so a user who pays and closes the tab is left with a
  // captured payment and no entitlement until they come back.
  const qrCodeId = payload.payload?.qr_code?.entity?.id;
  if (qrCodeId) {
    const qrNotes = payload.payload?.qr_code?.entity?.notes ?? notes;
    const qrUserId = qrNotes.userId;

    try {
      const purchase = await prisma.payment.findUnique({
        where: { providerQrCodeId: qrCodeId },
        select: { userId: true },
      });

      if (purchase) {
        // Idempotent: settlePurchaseQr claims the row CREATED -> SUCCESS, so a
        // race with the dialog's poll grants the entitlement exactly once.
        await settlePurchaseQr(purchase.userId, qrCodeId);
        billingLogger.info({ qrCodeId }, "Webhook settled UPI QR purchase");
      } else if (qrUserId && paymentId) {
        await settleRecharge({
          razorpayQrCodeId: qrCodeId,
          razorpayPaymentId: paymentId,
          eventId: `qr:${paymentId}`,
        });
        billingLogger.info({ qrCodeId }, "Webhook settled UPI QR recharge");
      }

      await prisma.paymentEvent.create({
        data: { provider: "RAZORPAY", eventId, eventType, status: "PROCESSED" },
      });
    } catch (error) {
      billingLogger.error({ qrCodeId, eventId, err: error }, "Failed to settle QR webhook");
      return NextResponse.json({ error: "Processing failed" }, { status: 500 });
    }

    return NextResponse.json({ received: true });
  }

  if (eventType === "payment.captured" || eventType === "order.paid") {
    const userId = notes.userId;
    const paymentType = notes.type; // "SUBSCRIPTION" | "ADDITIONAL_GSTIN"

    if (userId && paymentId) {
      try {
        if (paymentType === "SUBSCRIPTION" && notes.planSlug) {
          await activatePaidPlan({
            userId,
            planSlug: notes.planSlug as PlanSlug,
            paymentId,
            providerOrderId: orderId,
            amountRupees,
          });
          billingLogger.info(
            { userId, planSlug: notes.planSlug },
            "Webhook activated subscription"
          );
        } else if (paymentType === "ADDITIONAL_GSTIN" && notes.quantity) {
          const qty = parseInt(notes.quantity, 10);
          if (qty > 0) {
            await addGstinCapacity({
              userId,
              quantity: qty,
              amountRupees,
              paymentId,
              providerOrderId: orderId,
            });
            billingLogger.info({ userId, qty }, "Webhook added GSTIN capacity");
          }
        }

        // Record successful event processing
        await prisma.paymentEvent.create({
          data: {
            provider: "RAZORPAY",
            eventId,
            eventType,
            status: "PROCESSED",
          },
        });
      } catch (error) {
        billingLogger.error({ orderId, eventId, err: error }, "Failed to process payment webhook");
        return NextResponse.json({ error: "Processing failed" }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
