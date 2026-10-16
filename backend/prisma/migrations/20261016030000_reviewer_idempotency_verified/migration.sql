-- Additive and nullable: safe to apply while the app is running; old code ignores the new columns.

-- Who reviewed (approved / rejected) a payment. Existing rows stay NULL.
ALTER TABLE "payments" ADD COLUMN "reviewed_by_id" UUID;
ALTER TABLE "payments" ADD CONSTRAINT "payments_reviewed_by_id_fkey"
  FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Idempotency key for POST /payments/submit; unique per submitter. NULLs never collide.
ALTER TABLE "payments" ADD COLUMN "idempotency_key" TEXT;
CREATE UNIQUE INDEX "payments_submitted_by_id_idempotency_key_key"
  ON "payments"("submitted_by_id", "idempotency_key");

-- Last time Intuit confirmed the stored QuickBooks connection works.
ALTER TABLE "qbo_tokens" ADD COLUMN "last_verified_at" TIMESTAMP(3);
