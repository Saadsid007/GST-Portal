-- Column mappings that survive the upload they were made in.
--
-- A mapping profile could only be found by name and platform, and nothing in
-- the product ever saved or read one. Every upload therefore re-solved the same
-- file from scratch, so a correction the user made last month was gone this
-- month and the model could answer differently the second time.
--
-- The fingerprint is a hash of the file's header set, which lets an export
-- recognise itself without the user naming or choosing anything. Unique per
-- user, not global: one seller's column choices must never be applied to
-- another seller's return, however alike the two files look.

-- AlterTable
ALTER TABLE "mapping_profile" ADD COLUMN     "fingerprint" TEXT,
ADD COLUMN     "source_headers" JSONB,
ADD COLUMN     "use_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_used_at" TIMESTAMPTZ;

-- CreateIndex
-- Rows created before this migration have a NULL fingerprint. Postgres treats
-- NULLs as distinct in a unique index, so existing profiles do not collide.
CREATE UNIQUE INDEX "mapping_profile_user_id_fingerprint_key" ON "mapping_profile"("user_id", "fingerprint");
