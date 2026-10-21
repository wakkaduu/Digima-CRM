-- Additive and nullable: safe to apply while the app is running; old code ignores the new column.

-- Object storage key prefix of the receipt (e.g. "payment-proofs/<uuid>"). NULL = receipt is still on Cloudinary.
-- proof_image_url / proof_public_id are left untouched on migrated rows so the Cloudinary copy stays traceable.
ALTER TABLE "payments" ADD COLUMN "proof_key" TEXT;
