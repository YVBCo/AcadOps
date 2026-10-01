-- Multi-Tenant Migration Script
-- Creates default tenant, adds tenant_id columns, and seeds developer account

-- Step 1: Create new tables
CREATE TABLE IF NOT EXISTS "developers" (
  "id" SERIAL PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "password_hash" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "tenants" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "type" TEXT NOT NULL DEFAULT 'ENGINEERING',
  "max_users" INTEGER NOT NULL DEFAULT 500,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "contact_email" TEXT,
  "contact_phone" TEXT,
  "address" TEXT,
  "logo_url" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "system_errors" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" INTEGER,
  "error_code" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "stack" TEXT,
  "endpoint" TEXT,
  "method" TEXT,
  "user_id" INTEGER,
  "metadata" JSONB,
  "severity" TEXT NOT NULL DEFAULT 'ERROR',
  "resolved" BOOLEAN NOT NULL DEFAULT false,
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "system_errors_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "system_errors_tenant_id_created_at_idx" ON "system_errors"("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "system_errors_severity_resolved_idx" ON "system_errors"("severity", "resolved");
CREATE INDEX IF NOT EXISTS "system_errors_created_at_idx" ON "system_errors"("created_at");

-- Step 2: Create default tenant for existing data
INSERT INTO "tenants" ("name", "slug", "type", "max_users", "is_active")
VALUES ('Default College', 'default', 'ENGINEERING', 1000, true)
ON CONFLICT ("slug") DO NOTHING;

-- Step 3: Add tenant_id columns with default value (pointing to default tenant)
DO $$
DECLARE
  default_tenant_id INTEGER;
BEGIN
  SELECT id INTO default_tenant_id FROM "tenants" WHERE "slug" = 'default';

  -- Users
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'tenant_id') THEN
    ALTER TABLE "users" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT default_tenant_id;
    ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id");
    ALTER TABLE "users" ALTER COLUMN "tenant_id" DROP DEFAULT;
  END IF;

  -- Departments
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'departments' AND column_name = 'tenant_id') THEN
    ALTER TABLE "departments" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT default_tenant_id;
    ALTER TABLE "departments" ADD CONSTRAINT "departments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id");
    ALTER TABLE "departments" ALTER COLUMN "tenant_id" DROP DEFAULT;
    -- Drop old unique constraints and add tenant-scoped ones
    ALTER TABLE "departments" DROP CONSTRAINT IF EXISTS "departments_name_key";
    ALTER TABLE "departments" DROP CONSTRAINT IF EXISTS "departments_code_key";
    ALTER TABLE "departments" ADD CONSTRAINT "departments_tenant_id_code_key" UNIQUE ("tenant_id", "code");
    ALTER TABLE "departments" ADD CONSTRAINT "departments_tenant_id_name_key" UNIQUE ("tenant_id", "name");
  END IF;

  -- Batches
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batches' AND column_name = 'tenant_id') THEN
    ALTER TABLE "batches" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT default_tenant_id;
    ALTER TABLE "batches" ADD CONSTRAINT "batches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id");
    ALTER TABLE "batches" ALTER COLUMN "tenant_id" DROP DEFAULT;
    ALTER TABLE "batches" DROP CONSTRAINT IF EXISTS "batches_name_key";
    ALTER TABLE "batches" ADD CONSTRAINT "batches_tenant_id_name_key" UNIQUE ("tenant_id", "name");
  END IF;

  -- Semesters
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'semesters' AND column_name = 'tenant_id') THEN
    ALTER TABLE "semesters" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT default_tenant_id;
    ALTER TABLE "semesters" ADD CONSTRAINT "semesters_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id");
    ALTER TABLE "semesters" ALTER COLUMN "tenant_id" DROP DEFAULT;
  END IF;

  -- Courses
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'courses' AND column_name = 'tenant_id') THEN
    ALTER TABLE "courses" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT default_tenant_id;
    ALTER TABLE "courses" ADD CONSTRAINT "courses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id");
    ALTER TABLE "courses" ALTER COLUMN "tenant_id" DROP DEFAULT;
    ALTER TABLE "courses" DROP CONSTRAINT IF EXISTS "courses_code_key";
    ALTER TABLE "courses" ADD CONSTRAINT "courses_tenant_id_code_key" UNIQUE ("tenant_id", "code");
  END IF;

  -- Programs
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'programs' AND column_name = 'tenant_id') THEN
    ALTER TABLE "programs" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT default_tenant_id;
    ALTER TABLE "programs" ADD CONSTRAINT "programs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id");
    ALTER TABLE "programs" ALTER COLUMN "tenant_id" DROP DEFAULT;
    ALTER TABLE "programs" DROP CONSTRAINT IF EXISTS "programs_code_key";
    ALTER TABLE "programs" ADD CONSTRAINT "programs_tenant_id_code_key" UNIQUE ("tenant_id", "code");
  END IF;

  -- Sections
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sections' AND column_name = 'tenant_id') THEN
    ALTER TABLE "sections" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT default_tenant_id;
    ALTER TABLE "sections" ADD CONSTRAINT "sections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id");
    ALTER TABLE "sections" ALTER COLUMN "tenant_id" DROP DEFAULT;
  END IF;

  -- Notifications
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'tenant_id') THEN
    ALTER TABLE "notifications" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT default_tenant_id;
    ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id");
    ALTER TABLE "notifications" ALTER COLUMN "tenant_id" DROP DEFAULT;
  END IF;

  -- Audit Logs (nullable tenant_id)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'tenant_id') THEN
    ALTER TABLE "audit_logs" ADD COLUMN "tenant_id" INTEGER;
    ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id");
    UPDATE "audit_logs" SET "tenant_id" = default_tenant_id;
  END IF;

  RAISE NOTICE 'Migration complete. Default tenant ID: %', default_tenant_id;
END $$;

-- Step 4: Create indexes
CREATE INDEX IF NOT EXISTS "users_tenant_id_idx" ON "users"("tenant_id");
CREATE INDEX IF NOT EXISTS "users_tenant_id_email_is_active_idx" ON "users"("tenant_id", "email", "is_active");
CREATE INDEX IF NOT EXISTS "users_tenant_id_role_is_active_idx" ON "users"("tenant_id", "role", "is_active");
CREATE INDEX IF NOT EXISTS "departments_tenant_id_idx" ON "departments"("tenant_id");
CREATE INDEX IF NOT EXISTS "batches_tenant_id_idx" ON "batches"("tenant_id");
CREATE INDEX IF NOT EXISTS "semesters_tenant_id_idx" ON "semesters"("tenant_id");
CREATE INDEX IF NOT EXISTS "courses_tenant_id_idx" ON "courses"("tenant_id");
CREATE INDEX IF NOT EXISTS "programs_tenant_id_idx" ON "programs"("tenant_id");
CREATE INDEX IF NOT EXISTS "sections_tenant_id_idx" ON "sections"("tenant_id");
CREATE INDEX IF NOT EXISTS "notifications_tenant_id_idx" ON "notifications"("tenant_id");
CREATE INDEX IF NOT EXISTS "audit_logs_tenant_id_idx" ON "audit_logs"("tenant_id");

-- Step 5: Create TenantType enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TenantType') THEN
    CREATE TYPE "TenantType" AS ENUM ('ENGINEERING', 'MEDICAL', 'DEGREE', 'MBA', 'MCA', 'LAW', 'PHARMACY', 'OTHER');
  END IF;
END $$;

-- Update tenants table to use enum
-- (Prisma will handle this on next db push after migration)
