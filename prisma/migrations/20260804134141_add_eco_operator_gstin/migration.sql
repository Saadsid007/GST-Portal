-- CreateTable
CREATE TABLE "eco_operator_gstin" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "gstin_number" TEXT NOT NULL,
    "platform_id" TEXT NOT NULL,
    "eco_gstin" TEXT NOT NULL,
    "eco_name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "eco_operator_gstin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "eco_operator_gstin_user_id_idx" ON "eco_operator_gstin"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "eco_operator_gstin_user_id_gstin_number_platform_id_key" ON "eco_operator_gstin"("user_id", "gstin_number", "platform_id");

-- AddForeignKey
ALTER TABLE "eco_operator_gstin" ADD CONSTRAINT "eco_operator_gstin_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
