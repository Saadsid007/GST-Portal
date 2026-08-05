import crypto from "node:crypto";
import Razorpay from "razorpay";
import { requireRazorpayEnv } from "@/lib/env";

/**
 * Thin wrapper over the Razorpay SDK. Everything that touches the secret key
 * lives here so no other module needs it, and every signature check goes through
 * the timing-safe comparison below.
 */

let cached: Razorpay | null = null;

function client(): Razorpay {
  if (cached) return cached;
  const { keyId, keySecret } = requireRazorpayEnv();
  cached = new Razorpay({ key_id: keyId, key_secret: keySecret });
  return cached;
}

export interface CreatedOrder {
  orderId: string;
  amountPaise: number;
  keyId: string;
}

/** Razorpay works in paise; credits work in rupees. The conversion lives here only. */
export async function createRazorpayOrder(
  amountRupees: number,
  receipt: string,
  notes: Record<string, string>
): Promise<CreatedOrder> {
  const { keyId } = requireRazorpayEnv();
  const amountPaise = Math.round(amountRupees * 100);

  const order = await client().orders.create({
    amount: amountPaise,
    currency: "INR",
    receipt,
    notes,
  });

  return { orderId: order.id, amountPaise, keyId };
}

/**
 * Constant-time HMAC comparison. A plain `===` on a signature leaks how many
 * leading bytes matched, which is enough to forge one given enough attempts.
 */
function safeEqual(expected: string, received: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Verifies the signature Razorpay Checkout hands back to the browser. */
export function verifyCheckoutSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const { keySecret } = requireRazorpayEnv();
  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest("hex");
  return safeEqual(expected, input.signature);
}

/**
 * Verifies a webhook against the RAW request body. The body must not be parsed
 * and re-serialised first — any whitespace change breaks the HMAC.
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const { webhookSecret } = requireRazorpayEnv();
  const expected = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  return safeEqual(expected, signature);
}

export async function fetchPayment(paymentId: string) {
  return client().payments.fetch(paymentId);
}

/* ── UPI QR ─────────────────────────────────────────────────────────────── */

export interface CreatedQrCode {
  qrCodeId: string;
  /** Razorpay-hosted PNG of the QR. Rendered directly; never proxied. */
  imageUrl: string;
  amountPaise: number;
  /** Unix seconds. The QR stops accepting payment after this. */
  closeBy: number;
}

/** How long a generated QR stays payable. Razorpay requires >= 15 minutes. */
export const QR_TTL_SECONDS = 20 * 60;

/**
 * Creates a fixed-amount, single-use UPI QR.
 *
 * `fixed_amount` + `single_use` together are what make settlement safe: the
 * payer cannot alter the amount, and the QR cannot be paid twice. Without them
 * a shared screenshot could be paid repeatedly against one recharge row.
 */
export async function createUpiQrCode(input: {
  amountRupees: number;
  description: string;
  notes: Record<string, string>;
}): Promise<CreatedQrCode> {
  const amountPaise = Math.round(input.amountRupees * 100);
  const closeBy = Math.floor(Date.now() / 1000) + QR_TTL_SECONDS;

  const qr = await client().qrCode.create({
    type: "upi_qr",
    name: "GSTPilot wallet recharge",
    usage: "single_use",
    fixed_amount: true,
    payment_amount: amountPaise,
    description: input.description,
    close_by: closeBy,
    notes: input.notes,
  });

  return {
    qrCodeId: qr.id,
    imageUrl: qr.image_url,
    amountPaise,
    closeBy: qr.close_by ?? closeBy,
  };
}

export async function closeQrCode(qrCodeId: string): Promise<void> {
  await client().qrCode.close(qrCodeId);
}

/**
 * Payments received against a QR. Backs the polling fallback — the webhook is
 * authoritative, but someone watching the screen should not have to wait on
 * webhook delivery to see their recharge land.
 */
export async function fetchQrPayments(qrCodeId: string) {
  const result = await client().qrCode.fetchAllPayments(qrCodeId);
  return result.items ?? [];
}
