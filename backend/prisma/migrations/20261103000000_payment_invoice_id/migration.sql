-- The QuickBooks invoice a payment was recorded against. The invoice is created when the first payment for an estimate
-- is approved; later payments reuse it. Additive and nullable, so it is safe to apply while the app is running.
ALTER TABLE "payments" ADD COLUMN "qbo_invoice_id" TEXT;
