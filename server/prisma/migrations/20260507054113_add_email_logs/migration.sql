-- CreateTable: email_logs
-- Tracks every email send attempt for developer dashboard visibility

CREATE TABLE IF NOT EXISTS "email_logs" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL DEFAULT 'log',
    "message_id" TEXT,
    "error_message" TEXT,
    "email_type" TEXT,
    "user_id" INTEGER,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE INDEX IF NOT EXISTS "email_logs_tenant_id_created_at_idx" ON "email_logs"("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "email_logs_status_created_at_idx" ON "email_logs"("status", "created_at");
CREATE INDEX IF NOT EXISTS "email_logs_to_created_at_idx" ON "email_logs"("to", "created_at");
CREATE INDEX IF NOT EXISTS "email_logs_email_type_status_idx" ON "email_logs"("email_type", "status");

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
