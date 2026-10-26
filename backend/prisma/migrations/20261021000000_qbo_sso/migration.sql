-- QuickBooks single sign-on: users sign in with their own Intuit account and each holds their own QBO tokens.

-- SuperAdmin role (account management + reports).
ALTER TYPE "UserRole" ADD VALUE 'superadmin';

-- Passwords are no longer used to sign in; keep existing hashes but stop requiring one.
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;

-- Intuit account id (OpenID "sub"), linked the first time the user signs in with QuickBooks.
ALTER TABLE "users" ADD COLUMN "qbo_sub" TEXT;
CREATE UNIQUE INDEX "users_qbo_sub_key" ON "users"("qbo_sub");

-- The single shared QuickBooks connection becomes one connection per user.
-- The old row is dropped on purpose: it belonged to whichever admin connected, and everyone
-- (including that admin) now re-authorizes by signing in with QuickBooks.
DROP TABLE "qbo_tokens";

CREATE TABLE "qbo_tokens" (
    "user_id" UUID NOT NULL,
    "realm_id" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "access_token_expires_at" TIMESTAMP(3) NOT NULL,
    "refresh_token_expires_at" TIMESTAMP(3) NOT NULL,
    "last_verified_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "qbo_tokens_pkey" PRIMARY KEY ("user_id")
);

ALTER TABLE "qbo_tokens" ADD CONSTRAINT "qbo_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
