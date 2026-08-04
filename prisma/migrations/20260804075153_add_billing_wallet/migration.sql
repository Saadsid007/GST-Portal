-- AlterTable
ALTER TABLE "user" ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "wallet" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "lifetime_recharged" INTEGER NOT NULL DEFAULT 0,
    "lifetime_used" INTEGER NOT NULL DEFAULT 0,
    "bonus_earned" INTEGER NOT NULL DEFAULT 0,
    "referral_earned" INTEGER NOT NULL DEFAULT 0,
    "admin_credited" INTEGER NOT NULL DEFAULT 0,
    "free_generations_used" INTEGER NOT NULL DEFAULT 0,
    "is_frozen" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transaction" (
    "id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "credit_amount" INTEGER NOT NULL,
    "balance_before" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "reference_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recharge_order" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "razorpay_order_id" TEXT NOT NULL,
    "razorpay_payment_id" TEXT,
    "amount" INTEGER NOT NULL,
    "bonus_credits" INTEGER NOT NULL DEFAULT 0,
    "total_credits" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "webhook_event_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "recharge_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_code" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_code_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_token" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_by_user_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral" (
    "id" UUID NOT NULL,
    "referrer_id" TEXT NOT NULL,
    "referee_id" TEXT NOT NULL,
    "code_used" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rewarded_at" TIMESTAMPTZ,
    "referee_gstin" TEXT,
    "referee_mobile" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_code" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "max_redemptions" INTEGER NOT NULL DEFAULT 1,
    "redemption_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "credit_code_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_code_redemption" (
    "id" UUID NOT NULL,
    "credit_code_id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_code_redemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_config" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "billing_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "current_period_end" TIMESTAMPTZ,
    "razorpay_subscription_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallet_user_id_key" ON "wallet"("user_id");

-- CreateIndex
CREATE INDEX "wallet_transaction_wallet_id_idx" ON "wallet_transaction"("wallet_id");

-- CreateIndex
CREATE INDEX "wallet_transaction_created_at_idx" ON "wallet_transaction"("created_at");

-- CreateIndex
CREATE INDEX "wallet_transaction_type_idx" ON "wallet_transaction"("type");

-- CreateIndex
CREATE UNIQUE INDEX "recharge_order_razorpay_order_id_key" ON "recharge_order"("razorpay_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "recharge_order_webhook_event_id_key" ON "recharge_order"("webhook_event_id");

-- CreateIndex
CREATE INDEX "recharge_order_user_id_idx" ON "recharge_order"("user_id");

-- CreateIndex
CREATE INDEX "recharge_order_status_idx" ON "recharge_order"("status");

-- CreateIndex
CREATE UNIQUE INDEX "referral_code_user_id_key" ON "referral_code"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "referral_code_code_key" ON "referral_code"("code");

-- CreateIndex
CREATE UNIQUE INDEX "referral_token_token_key" ON "referral_token"("token");

-- CreateIndex
CREATE INDEX "referral_token_user_id_idx" ON "referral_token"("user_id");

-- CreateIndex
CREATE INDEX "referral_token_expires_at_idx" ON "referral_token"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "referral_referee_id_key" ON "referral"("referee_id");

-- CreateIndex
CREATE INDEX "referral_referrer_id_idx" ON "referral"("referrer_id");

-- CreateIndex
CREATE INDEX "referral_status_idx" ON "referral"("status");

-- CreateIndex
CREATE UNIQUE INDEX "credit_code_code_key" ON "credit_code"("code");

-- CreateIndex
CREATE INDEX "credit_code_is_active_idx" ON "credit_code"("is_active");

-- CreateIndex
CREATE INDEX "credit_code_redemption_user_id_idx" ON "credit_code_redemption"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_code_redemption_credit_code_id_user_id_key" ON "credit_code_redemption"("credit_code_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_config_key_key" ON "billing_config"("key");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_user_id_key" ON "subscription"("user_id");

-- CreateIndex
CREATE INDEX "audit_log_actor_id_idx" ON "audit_log"("actor_id");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

-- CreateIndex
CREATE INDEX "audit_log_action_idx" ON "audit_log"("action");

-- AddForeignKey
ALTER TABLE "wallet" ADD CONSTRAINT "wallet_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transaction" ADD CONSTRAINT "wallet_transaction_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recharge_order" ADD CONSTRAINT "recharge_order_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_code" ADD CONSTRAINT "referral_code_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_token" ADD CONSTRAINT "referral_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral" ADD CONSTRAINT "referral_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral" ADD CONSTRAINT "referral_referee_id_fkey" FOREIGN KEY ("referee_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_code" ADD CONSTRAINT "credit_code_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_code_redemption" ADD CONSTRAINT "credit_code_redemption_credit_code_id_fkey" FOREIGN KEY ("credit_code_id") REFERENCES "credit_code"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_code_redemption" ADD CONSTRAINT "credit_code_redemption_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
