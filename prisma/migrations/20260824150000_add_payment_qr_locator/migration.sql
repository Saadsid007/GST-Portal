-- UPI QR as a first-class way to pay for a plan or extra GSTIN capacity.
--
-- A Razorpay QR code is a standalone entity, not an order, so it needs its own
-- locator on the payment row. Unique for the same reason providerOrderId is:
-- it is what makes settlement idempotent when the webhook and the poller race.

-- AlterTable
ALTER TABLE "payment" ADD COLUMN     "provider_qr_code_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "payment_provider_qr_code_id_key" ON "payment"("provider_qr_code_id");
