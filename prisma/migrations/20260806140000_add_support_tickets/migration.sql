-- Support + contact inbox.
--
-- Two new tables only; nothing existing is altered beyond the FK on user, which
-- is ON DELETE SET NULL so deleting an account never destroys the ticket trail.

-- CreateTable
CREATE TABLE "support_ticket" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "user_id" TEXT,
    "reference_id" TEXT,
    "assigned_to_id" TEXT,
    "resolved_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "support_ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_ticket_reply" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "is_from_admin" BOOLEAN NOT NULL DEFAULT false,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "author_name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_ticket_reply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "support_ticket_reference_key" ON "support_ticket"("reference");

-- CreateIndex
CREATE INDEX "support_ticket_status_created_at_idx" ON "support_ticket"("status", "created_at");

-- CreateIndex
CREATE INDEX "support_ticket_user_id_idx" ON "support_ticket"("user_id");

-- CreateIndex
CREATE INDEX "support_ticket_source_idx" ON "support_ticket"("source");

-- CreateIndex
CREATE INDEX "support_ticket_reply_ticket_id_created_at_idx" ON "support_ticket_reply"("ticket_id", "created_at");

-- AddForeignKey
ALTER TABLE "support_ticket" ADD CONSTRAINT "support_ticket_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_reply" ADD CONSTRAINT "support_ticket_reply_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

