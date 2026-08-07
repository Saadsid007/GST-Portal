-- Nature of business on each GSTIN profile.
--
-- Additive with a default, so existing profiles land on OTHER and nothing
-- breaks. Users can classify them at leisure.

-- AlterTable
ALTER TABLE "gstin_profile" ADD COLUMN     "business_type" TEXT NOT NULL DEFAULT 'OTHER';

