"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Razorpay's `image_url` is not a bare QR — it is a 674×1644 marketing poster:
 * a "Powered by Razorpay" wordmark, a blue ribbon, BHIM/UPI marks, the QR, a
 * caption, GPay/PhonePe/Paytm logos and the merchant name. Rendering it whole
 * inside a dialog shrinks the actual scannable square to something unusable,
 * and forcing it into a square distorts it.
 *
 * The API returns no raw UPI string, so the poster is the only artifact we get
 * and the QR has to be cropped out of it. These bounds were measured from the
 * real asset (2026-08-06); the poster layout is fixed, only the QR modules
 * change between codes.
 *
 * If Razorpay ever re-lays-out the poster this crop drifts, which is why the
 * dialog always offers "open the full QR" as an escape hatch.
 */
const POSTER = { width: 674, height: 1644 } as const;
const QR_BOX = { x: 146, y: 658, size: 381 } as const;

export function UpiQrImage({
  imageUrl,
  amount,
  className,
}: {
  imageUrl: string;
  amount: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        // White is not decorative here: a QR needs a light quiet zone around it
        // to stay scannable, and this padding provides it in both themes.
        "relative mx-auto w-fit rounded-2xl bg-white p-4 shadow-md ring-1 ring-black/5",
        className
      )}
    >
      <div className="relative size-[224px] overflow-hidden sm:size-[248px]">
        <Image
          src={imageUrl}
          alt={`UPI QR code to pay ₹${amount.toLocaleString("en-IN")}`}
          width={POSTER.width}
          height={POSTER.height}
          // Never resampled — scaling a QR softens module edges and costs scans.
          unoptimized
          priority
          className="absolute max-w-none"
          style={{
            width: `${(POSTER.width / QR_BOX.size) * 100}%`,
            height: `${(POSTER.height / QR_BOX.size) * 100}%`,
            left: `${-(QR_BOX.x / QR_BOX.size) * 100}%`,
            top: `${-(QR_BOX.y / QR_BOX.size) * 100}%`,
          }}
        />
      </div>
    </div>
  );
}
