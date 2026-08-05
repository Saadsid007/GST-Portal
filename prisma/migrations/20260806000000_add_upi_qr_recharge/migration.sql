-- UPI QR recharge support.
--
-- A Razorpay QR code is a standalone entity, not an order, so a QR-paid
-- recharge has no razorpay_order_id. The column is widened to nullable and a
-- second locator is added; exactly one of the two is set per row, decided by
-- `method`. Existing rows are all CHECKOUT, which the default backfills.
--
-- Purely additive: no existing column is dropped and no data is rewritten.

-- AlterTable
ALTER TABLE "recharge_order" ADD COLUMN     "method" TEXT NOT NULL DEFAULT 'CHECKOUT',
ADD COLUMN     "razorpay_qr_code_id" TEXT,
ALTER COLUMN "razorpay_order_id" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "recharge_order_razorpay_qr_code_id_key" ON "recharge_order"("razorpay_qr_code_id");
