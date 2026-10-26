-- One-time invite links: a SuperAdmin invites a person, who links their Intuit account (users.qbo_sub)
-- by opening the link and signing in with QuickBooks. Only the SHA-256 hash of the token is stored.
-- Additive and nullable: safe to apply while the app is running.
ALTER TABLE "users" ADD COLUMN "invite_token_hash" TEXT,
ADD COLUMN "invite_expires_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "users_invite_token_hash_key" ON "users"("invite_token_hash");
