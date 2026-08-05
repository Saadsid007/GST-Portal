import { NextResponse } from "next/server";
import { billingLogger } from "@/features/billing/services/billing.logger";
import { verifyWebhookSignature } from "@/features/billing/services/razorpay.service";
import { markRechargeFailed, settleRecharge } from "@/features/billing/services/recharge.service";

/**
 * Razorpay's authoritative settlement path. Razorpay carries no session cookie,
 * so this route is whitelisted in `middleware.ts` and authenticated purely by
 * the HMAC over the raw body.
 */

interface RazorpayWebhookPayload {
  event?: string;
  payload?: {
    payment?: {
      entity?: { id?: string; order_id?: string };
    };
    qr_code?: {
      entity?: { id?: string };
    };
  };
}

export async function POST(request: Request): Promise<NextResponse> {
  // Must read the raw text before any JSON parse — re-serialising the body
  // changes whitespace and breaks the signature.
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!signature || !verifyWebhookSignature(rawBody, signature)) {
    billingLogger.warn("Rejected Razorpay webhook with an invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let payload: RazorpayWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as RazorpayWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }

  const entity = payload.payload?.payment?.entity;
  const orderId = entity?.order_id;
  const paymentId = entity?.id;
  const qrCodeId = payload.payload?.qr_code?.entity?.id;

  // A QR payment carries no order_id — the QR code entity is the locator.
  if (payload.event === "qr_code.credited" && qrCodeId && paymentId) {
    try {
      const eventId = request.headers.get("x-razorpay-event-id") ?? `qr:${paymentId}`;
      const result = await settleRecharge({
        razorpayQrCodeId: qrCodeId,
        razorpayPaymentId: paymentId,
        eventId,
      });
      billingLogger.info(
        { qrCodeId, credited: result.credited },
        "Webhook settled UPI QR recharge"
      );
    } catch (error) {
      billingLogger.error({ qrCodeId, err: error }, "Failed to settle UPI QR recharge");
      // 500 makes Razorpay retry, which is what we want for a transient failure.
      return NextResponse.json({ error: "Settlement failed" }, { status: 500 });
    }
    return NextResponse.json({ received: true });
  }

  if (!orderId || !paymentId) {
    // Events we don't handle (subscriptions, refunds, settlements) are acknowledged
    // so Razorpay stops retrying them.
    return NextResponse.json({ received: true });
  }

  try {
    if (payload.event === "payment.captured" || payload.event === "order.paid") {
      // Razorpay's delivery id is the natural idempotency key; the payment id is a
      // stable fallback when the header is absent.
      const eventId = request.headers.get("x-razorpay-event-id") ?? `payment:${paymentId}`;
      const result = await settleRecharge({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        eventId,
      });
      billingLogger.info({ orderId, credited: result.credited }, "Webhook settled recharge");
    } else if (payload.event === "payment.failed") {
      await markRechargeFailed({ razorpayOrderId: orderId });
    }
  } catch (error) {
    billingLogger.error({ orderId, err: error }, "Webhook settlement failed");
    // A 500 makes Razorpay retry, which is safe because settlement is idempotent.
    return NextResponse.json({ error: "Settlement failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
