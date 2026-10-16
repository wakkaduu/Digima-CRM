-- CreateEnum
CREATE TYPE "BankAccount" AS ENUM ('BDO', 'UnionBank', 'Digima', 'Happy Meal');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "customer_name" TEXT NOT NULL,
    "qbo_estimate_id" TEXT NOT NULL,
    "amount_submitted" DECIMAL(14,2) NOT NULL,
    "final_amount" DECIMAL(14,2),
    "bank_deposited_to" "BankAccount" NOT NULL,
    "proof_image_url" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "submitted_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "qbo_customer_id" TEXT,
    "qbo_payment_id" TEXT,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qbo_tokens" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "realm_id" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "access_token_expires_at" TIMESTAMP(3) NOT NULL,
    "refresh_token_expires_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "qbo_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_qbo_payment_id_key" ON "payments"("qbo_payment_id");

-- CreateIndex
CREATE INDEX "payments_status_created_at_idx" ON "payments"("status", "created_at");

-- CreateIndex
CREATE INDEX "payments_qbo_estimate_id_idx" ON "payments"("qbo_estimate_id");
