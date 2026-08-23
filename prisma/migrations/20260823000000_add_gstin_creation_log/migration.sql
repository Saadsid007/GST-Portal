-- Append-only ledger of every GSTIN profile creation.
--
-- Quota is measured against this ledger rather than the live gstin_profile
-- count. Deleting a profile no longer refunds the slot for the current billing
-- period, so delete-then-recreate cannot be used to cycle past the plan limit.
-- Usage is always counted from the subscription's startDate, so the ledger
-- stops counting on its own when the period rolls over.

-- CreateTable
CREATE TABLE "gstin_creation_log" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "profile_id" UUID NOT NULL,
    "gstin_number" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gstin_creation_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gstin_creation_log_user_id_created_at_idx" ON "gstin_creation_log"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "gstin_creation_log" ADD CONSTRAINT "gstin_creation_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every profile that exists today has already consumed its slot.
-- Without this, the first read after deploy would see an empty ledger and let
-- existing users delete-and-recreate freely for the rest of their period.
INSERT INTO "gstin_creation_log" ("id", "user_id", "profile_id", "gstin_number", "created_at")
SELECT gen_random_uuid(), "user_id", "id", "gstin_number", "created_at"
FROM "gstin_profile";
