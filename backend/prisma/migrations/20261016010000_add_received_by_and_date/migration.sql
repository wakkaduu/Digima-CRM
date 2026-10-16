-- Additive and nullable: existing payments have no value for these.
ALTER TABLE "payments" ADD COLUMN "received_on" DATE;
ALTER TABLE "payments" ADD COLUMN "received_by" TEXT;
