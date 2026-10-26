-- Reversing an approved payment: a new "voided" status plus who/when/why.
-- Additive: the new enum value is only used by code that ships with this migration, and the columns are nullable,
-- so it is safe to apply while the app is running.
ALTER TYPE "PaymentStatus" ADD VALUE 'voided';

ALTER TABLE "payments" ADD COLUMN "voided_at" TIMESTAMP(3),
ADD COLUMN "voided_by" TEXT,
ADD COLUMN "void_reason" TEXT;
