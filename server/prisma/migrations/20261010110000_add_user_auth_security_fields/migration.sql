-- Align the production users table with authentication fields in Prisma.
ALTER TABLE "users"
    ADD COLUMN IF NOT EXISTS "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "locked_until" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "token_version" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "last_password_changed_at" TIMESTAMP(3);
