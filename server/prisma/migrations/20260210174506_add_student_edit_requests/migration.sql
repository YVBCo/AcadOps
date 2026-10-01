-- CreateTable
CREATE TABLE "student_edit_requests" (
    "id" SERIAL NOT NULL,
    "student_profile_id" INTEGER NOT NULL,
    "requested_by" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "proposed_changes" JSONB NOT NULL,
    "reason" TEXT,
    "reviewed_by" INTEGER,
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "student_edit_requests_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "student_edit_requests" ADD CONSTRAINT "student_edit_requests_student_profile_id_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_edit_requests" ADD CONSTRAINT "student_edit_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_edit_requests" ADD CONSTRAINT "student_edit_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
