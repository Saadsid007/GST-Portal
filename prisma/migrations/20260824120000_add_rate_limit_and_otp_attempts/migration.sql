-- Abuse controls for the unauthenticated auth surface.
--
-- OTP attempt cap: a 6-digit code is ~1M wide, so with no cap it is
-- brute-forceable inside its own 15-minute validity window. The counter lets
-- verifyOtp destroy the code after a handful of wrong guesses.
--
-- Rate limiter: persisted rather than in-memory so limits survive a deploy and
-- hold across instances — a process restart is exactly when an attacker retries.

-- AlterTable
ALTER TABLE "verification" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "rate_limit" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "reset_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "rate_limit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rate_limit_key_key" ON "rate_limit"("key");

-- CreateIndex
CREATE INDEX "rate_limit_reset_at_idx" ON "rate_limit"("reset_at");
