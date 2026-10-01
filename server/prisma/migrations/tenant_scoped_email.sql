-- Migration: Convert email from global unique to tenant-scoped unique
-- Safe to run on existing data (no data loss)

-- Step 1: Drop the global unique constraint on email
DROP INDEX IF EXISTS "users_email_key";

-- Step 2: Add composite unique constraint (tenantId + email)
CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "users"("tenant_id", "email");
