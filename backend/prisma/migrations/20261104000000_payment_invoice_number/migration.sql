-- The invoice number (DocNumber) next to the invoice id, so the payment history can show the number people search for
-- in QuickBooks. Additive and nullable, so it is safe to apply while the app is running.
ALTER TABLE "payments" ADD COLUMN "qbo_invoice_number" TEXT;
