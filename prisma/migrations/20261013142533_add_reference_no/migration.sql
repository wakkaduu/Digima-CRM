-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "reference_no" TEXT;

-- CreateIndex
CREATE INDEX "payments_bank_deposited_to_reference_no_idx" ON "payments"("bank_deposited_to", "reference_no");
