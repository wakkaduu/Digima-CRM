-- Additive and nullable: links a payment to the sales employee who received it.
ALTER TABLE "payments" ADD COLUMN "received_by_id" UUID;
ALTER TABLE "payments" ADD CONSTRAINT "payments_received_by_id_fkey"
  FOREIGN KEY ("received_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "payments_received_by_id_idx" ON "payments"("received_by_id");
