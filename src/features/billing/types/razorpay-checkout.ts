/**
 * Types for the Razorpay Checkout script, which is loaded at runtime from
 * checkout.razorpay.com and therefore has no bundled type definitions.
 *
 * Declared once here so the payment surfaces stop each re-declaring
 * `Window.Razorpay` as `any` — an untyped handler is how a mis-shaped response
 * object reaches settlement code unnoticed.
 */

/** What Checkout hands back to the browser on a successful payment. */
export interface RazorpayCheckoutResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayFailureResponse {
  error?: {
    code?: string;
    description?: string;
    reason?: string;
  };
}

export interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  handler: (response: RazorpayCheckoutResponse) => void | Promise<void>;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  modal?: { ondismiss?: () => void };
}

export interface RazorpayCheckoutInstance {
  open: () => void;
  on: (event: "payment.failed", handler: (response: RazorpayFailureResponse) => void) => void;
}

export type RazorpayConstructor = new (
  options: RazorpayCheckoutOptions
) => RazorpayCheckoutInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

/**
 * Loads the Checkout script on demand and returns the constructor.
 *
 * Returns null rather than throwing when the script cannot load, so the caller
 * can show a network error instead of an unhandled rejection.
 */
export async function loadRazorpayCheckout(): Promise<RazorpayConstructor | null> {
  if (typeof window === "undefined") return null;
  if (window.Razorpay) return window.Razorpay;

  const loaded = await new Promise<boolean>((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

  return loaded ? (window.Razorpay ?? null) : null;
}
