-- Admin-managed offer strip.
--
-- New table only: nothing existing is touched, so this is safe to deploy ahead
-- of the code that reads it. An empty table simply renders no strip.

-- CreateTable
CREATE TABLE "announcement" (
    "id" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "link_label" TEXT,
    "link_href" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "starts_at" TIMESTAMPTZ,
    "ends_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "announcement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "announcement_is_active_sort_order_idx" ON "announcement"("is_active", "sort_order");
