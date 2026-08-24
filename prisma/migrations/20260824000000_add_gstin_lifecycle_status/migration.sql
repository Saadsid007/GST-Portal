-- GSTIN lifecycle status for the active-capacity + archive model.
--
-- Capacity is now consumed by the count of ACTIVE profiles. Archiving frees the
-- slot; the profile and its data are preserved and can be restored. Only ACTIVE
-- counts against the plan.

-- AlterTable
ALTER TABLE "gstin_profile" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "gstin_profile" ADD COLUMN     "archived_at" TIMESTAMPTZ;
ALTER TABLE "gstin_profile" ADD COLUMN     "status_changed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Collapse accidental duplicate profiles before enforcing uniqueness. Filing
-- data (conversion history, reports, audit rows) keys off gstin_number, not the
-- profile id, so removing duplicate profile rows loses no historical data. The
-- earliest row per (user, GSTIN) is kept.
DELETE FROM "gstin_profile" a
USING "gstin_profile" b
WHERE a."user_id" = b."user_id"
  AND a."gstin_number" = b."gstin_number"
  AND a."created_at" > b."created_at";

DELETE FROM "gstin_profile" a
USING "gstin_profile" b
WHERE a."user_id" = b."user_id"
  AND a."gstin_number" = b."gstin_number"
  AND a."created_at" = b."created_at"
  AND a."id" > b."id";

-- One profile per GSTIN per workspace across every status: a known GSTIN is
-- restored, never duplicated. Also the guard that makes concurrent
-- "add the same GSTIN" requests safe.
CREATE UNIQUE INDEX "gstin_profile_user_id_gstin_number_key" ON "gstin_profile"("user_id", "gstin_number");

-- CreateIndex
CREATE INDEX "gstin_profile_user_id_status_idx" ON "gstin_profile"("user_id", "status");
