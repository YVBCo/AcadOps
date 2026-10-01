-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('PENDING', 'APPROVED', 'POSTED', 'REJECTED');

-- CreateTable
CREATE TABLE "semester_mark_uploads" (
    "id" SERIAL NOT NULL,
    "batch_id" INTEGER NOT NULL,
    "department_id" INTEGER NOT NULL,
    "semester_number" INTEGER NOT NULL,
    "course_id" INTEGER NOT NULL,
    "uploaded_by" INTEGER NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "file_name" TEXT NOT NULL,
    "status" "UploadStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" INTEGER,
    "reviewed_at" TIMESTAMP(3),
    "review_notes" TEXT,
    "posted_by" INTEGER,
    "posted_at" TIMESTAMP(3),

    CONSTRAINT "semester_mark_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "semester_mark_entries" (
    "id" SERIAL NOT NULL,
    "upload_id" INTEGER NOT NULL,
    "student_usn" TEXT NOT NULL,
    "student_id" INTEGER NOT NULL,
    "course_id" INTEGER NOT NULL,
    "external_marks_raw" DOUBLE PRECISION NOT NULL,
    "external_marks" DOUBLE PRECISION NOT NULL,
    "validation_error" TEXT,

    CONSTRAINT "semester_mark_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parsing_corrections" (
    "id" SERIAL NOT NULL,
    "upload_id" INTEGER NOT NULL,
    "corrected_by" INTEGER NOT NULL,
    "corrected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "field_type" TEXT NOT NULL,
    "original_value" TEXT NOT NULL,
    "corrected_value" TEXT NOT NULL,
    "excel_pattern" TEXT NOT NULL,

    CONSTRAINT "parsing_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "semester_mark_uploads_status_idx" ON "semester_mark_uploads"("status");

-- CreateIndex
CREATE INDEX "semester_mark_uploads_batch_id_department_id_semester_numbe_idx" ON "semester_mark_uploads"("batch_id", "department_id", "semester_number");

-- CreateIndex
CREATE INDEX "semester_mark_entries_student_usn_idx" ON "semester_mark_entries"("student_usn");

-- CreateIndex
CREATE UNIQUE INDEX "semester_mark_entries_upload_id_student_usn_course_id_key" ON "semester_mark_entries"("upload_id", "student_usn", "course_id");

-- CreateIndex
CREATE INDEX "parsing_corrections_field_type_idx" ON "parsing_corrections"("field_type");

-- AddForeignKey
ALTER TABLE "semester_mark_uploads" ADD CONSTRAINT "semester_mark_uploads_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semester_mark_uploads" ADD CONSTRAINT "semester_mark_uploads_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semester_mark_uploads" ADD CONSTRAINT "semester_mark_uploads_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semester_mark_uploads" ADD CONSTRAINT "semester_mark_uploads_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semester_mark_uploads" ADD CONSTRAINT "semester_mark_uploads_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semester_mark_uploads" ADD CONSTRAINT "semester_mark_uploads_posted_by_fkey" FOREIGN KEY ("posted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semester_mark_entries" ADD CONSTRAINT "semester_mark_entries_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "semester_mark_uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semester_mark_entries" ADD CONSTRAINT "semester_mark_entries_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semester_mark_entries" ADD CONSTRAINT "semester_mark_entries_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parsing_corrections" ADD CONSTRAINT "parsing_corrections_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "semester_mark_uploads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parsing_corrections" ADD CONSTRAINT "parsing_corrections_corrected_by_fkey" FOREIGN KEY ("corrected_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
