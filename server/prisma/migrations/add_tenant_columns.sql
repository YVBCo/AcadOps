-- Add tenant_id columns to existing tables
-- Tables & default tenant already exist from previous migration

DO $$
DECLARE
  tid INTEGER;
BEGIN
  SELECT id INTO tid FROM tenants WHERE slug = 'default';
  IF tid IS NULL THEN
    RAISE EXCEPTION 'Default tenant not found!';
  END IF;

  -- Users
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='tenant_id') THEN
    EXECUTE format('ALTER TABLE users ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT %s', tid);
    ALTER TABLE users ADD CONSTRAINT users_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);
    ALTER TABLE users ALTER COLUMN tenant_id DROP DEFAULT;
  END IF;

  -- Departments
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='departments' AND column_name='tenant_id') THEN
    EXECUTE format('ALTER TABLE departments ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT %s', tid);
    ALTER TABLE departments ADD CONSTRAINT departments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);
    ALTER TABLE departments ALTER COLUMN tenant_id DROP DEFAULT;
    ALTER TABLE departments DROP CONSTRAINT IF EXISTS departments_name_key;
    ALTER TABLE departments DROP CONSTRAINT IF EXISTS departments_code_key;
  END IF;

  -- Batches
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='batches' AND column_name='tenant_id') THEN
    EXECUTE format('ALTER TABLE batches ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT %s', tid);
    ALTER TABLE batches ADD CONSTRAINT batches_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);
    ALTER TABLE batches ALTER COLUMN tenant_id DROP DEFAULT;
    ALTER TABLE batches DROP CONSTRAINT IF EXISTS batches_name_key;
  END IF;

  -- Semesters
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='semesters' AND column_name='tenant_id') THEN
    EXECUTE format('ALTER TABLE semesters ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT %s', tid);
    ALTER TABLE semesters ADD CONSTRAINT semesters_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);
    ALTER TABLE semesters ALTER COLUMN tenant_id DROP DEFAULT;
  END IF;

  -- Courses
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='courses' AND column_name='tenant_id') THEN
    EXECUTE format('ALTER TABLE courses ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT %s', tid);
    ALTER TABLE courses ADD CONSTRAINT courses_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);
    ALTER TABLE courses ALTER COLUMN tenant_id DROP DEFAULT;
    ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_code_key;
  END IF;

  -- Programs
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='programs' AND column_name='tenant_id') THEN
    EXECUTE format('ALTER TABLE programs ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT %s', tid);
    ALTER TABLE programs ADD CONSTRAINT programs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);
    ALTER TABLE programs ALTER COLUMN tenant_id DROP DEFAULT;
    ALTER TABLE programs DROP CONSTRAINT IF EXISTS programs_code_key;
  END IF;

  -- Sections
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sections' AND column_name='tenant_id') THEN
    EXECUTE format('ALTER TABLE sections ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT %s', tid);
    ALTER TABLE sections ADD CONSTRAINT sections_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);
    ALTER TABLE sections ALTER COLUMN tenant_id DROP DEFAULT;
  END IF;

  -- Notifications
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='tenant_id') THEN
    EXECUTE format('ALTER TABLE notifications ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT %s', tid);
    ALTER TABLE notifications ADD CONSTRAINT notifications_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);
    ALTER TABLE notifications ALTER COLUMN tenant_id DROP DEFAULT;
  END IF;

  -- Audit Logs (nullable)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='tenant_id') THEN
    ALTER TABLE audit_logs ADD COLUMN tenant_id INTEGER;
    ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id);
    EXECUTE format('UPDATE audit_logs SET tenant_id = %s', tid);
  END IF;

  RAISE NOTICE 'All tenant_id columns added. Default tenant ID: %', tid;
END $$;
