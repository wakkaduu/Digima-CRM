-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('sales', 'admin');

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "proof_public_id" TEXT,
ADD COLUMN     "sales_seen_at" TIMESTAMP(3),
ADD COLUMN     "submitted_by_id" UUID;

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "must_change_password" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "payments_submitted_by_id_status_idx" ON "payments"("submitted_by_id", "status");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
