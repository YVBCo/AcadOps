-- CreateEnum
CREATE TYPE "EditRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EditRequestType" AS ENUM ('ATTENDANCE', 'MARKS');

-- CreateTable
CREATE TABLE "edit_requests" (
    "id" SERIAL NOT NULL,
    "type" "EditRequestType" NOT NULL,
    "requester_id" INTEGER NOT NULL,
    "subject_id" INTEGER NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" INTEGER NOT NULL,
    "old_value" JSONB NOT NULL,
    "new_value" JSONB NOT NULL,
    "reason" TEXT,
    "status" "EditRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewer_id" INTEGER,
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "edit_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "edit_requests_status_idx" ON "edit_requests"("status");

-- CreateIndex
CREATE INDEX "edit_requests_requester_id_idx" ON "edit_requests"("requester_id");

-- CreateIndex
CREATE INDEX "edit_requests_subject_id_idx" ON "edit_requests"("subject_id");

-- AddForeignKey
ALTER TABLE "edit_requests" ADD CONSTRAINT "edit_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edit_requests" ADD CONSTRAINT "edit_requests_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
