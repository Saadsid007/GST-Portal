-- Phone at signup, last activity, and admin soft delete. All nullable: no
-- existing row changes, and code that predates them ignores the columns.
ALTER TABLE "user" ADD COLUMN "phone" TEXT;
ALTER TABLE "user" ADD COLUMN "last_active_at" TIMESTAMPTZ;
ALTER TABLE "user" ADD COLUMN "deleted_at" TIMESTAMPTZ;
ALTER TABLE "user" ADD COLUMN "original_email" TEXT;

CREATE INDEX "user_deleted_at_idx" ON "user"("deleted_at");
