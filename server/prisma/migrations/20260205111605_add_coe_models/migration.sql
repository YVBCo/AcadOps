-- CreateEnum
CREATE TYPE "MarksStatus" AS ENUM ('PENDING', 'APPROVED', 'LOCKED');

-- CreateEnum
CREATE TYPE "ResultStatus" AS ENUM ('PASS', 'MAKEUP_ELIGIBLE', 'FAIL');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'CLERK';

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "external_marks" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "internal_marks" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "is_locked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "locked_at" TIMESTAMP(3),
ADD COLUMN     "semester_number" INTEGER;

-- CreateTable
CREATE TABLE "internal_marks_submissions" (
    "id" SERIAL NOT NULL,
    "department_id" INTEGER NOT NULL,
    "batch_id" INTEGER NOT NULL,
    "course_id" INTEGER NOT NULL,
    "student_usn" TEXT NOT NULL,
    "marks" INTEGER NOT NULL,
    "submitted_by" INTEGER NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "internal_marks_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "semester_end_marks" (
    "id" SERIAL NOT NULL,
    "department_id" INTEGER NOT NULL,
    "batch_id" INTEGER NOT NULL,
    "course_id" INTEGER NOT NULL,
    "student_usn" TEXT NOT NULL,
    "marks" INTEGER NOT NULL,
    "entered_by" INTEGER NOT NULL,
    "entered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_by" INTEGER,
    "approved_at" TIMESTAMP(3),
    "status" "MarksStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "semester_end_marks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "results" (
    "id" SERIAL NOT NULL,
    "department_id" INTEGER NOT NULL,
    "batch_id" INTEGER NOT NULL,
    "course_id" INTEGER NOT NULL,
    "student_usn" TEXT NOT NULL,
    "internal_marks" INTEGER NOT NULL,
    "semester_marks" INTEGER NOT NULL,
    "total_marks" INTEGER NOT NULL,
    "status" "ResultStatus" NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "finalized_by" INTEGER,
    "finalized_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revaluations" (
    "id" SERIAL NOT NULL,
    "result_id" INTEGER NOT NULL,
    "old_marks" INTEGER NOT NULL,
    "new_marks" INTEGER NOT NULL,
    "entered_by" INTEGER NOT NULL,
    "entered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_by" INTEGER,
    "approved_at" TIMESTAMP(3),
    "status" "MarksStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "revaluations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "internal_marks_submissions_department_id_batch_id_course_id_key" ON "internal_marks_submissions"("department_id", "batch_id", "course_id", "student_usn");

-- CreateIndex
CREATE INDEX "semester_end_marks_status_idx" ON "semester_end_marks"("status");

-- CreateIndex
CREATE UNIQUE INDEX "semester_end_marks_department_id_batch_id_course_id_student_key" ON "semester_end_marks"("department_id", "batch_id", "course_id", "student_usn");

-- CreateIndex
CREATE INDEX "results_is_published_idx" ON "results"("is_published");

-- CreateIndex
CREATE UNIQUE INDEX "results_department_id_batch_id_course_id_student_usn_key" ON "results"("department_id", "batch_id", "course_id", "student_usn");

-- AddForeignKey
ALTER TABLE "internal_marks_submissions" ADD CONSTRAINT "internal_marks_submissions_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_marks_submissions" ADD CONSTRAINT "internal_marks_submissions_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_marks_submissions" ADD CONSTRAINT "internal_marks_submissions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_marks_submissions" ADD CONSTRAINT "internal_marks_submissions_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semester_end_marks" ADD CONSTRAINT "semester_end_marks_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semester_end_marks" ADD CONSTRAINT "semester_end_marks_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semester_end_marks" ADD CONSTRAINT "semester_end_marks_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semester_end_marks" ADD CONSTRAINT "semester_end_marks_entered_by_fkey" FOREIGN KEY ("entered_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semester_end_marks" ADD CONSTRAINT "semester_end_marks_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_finalized_by_fkey" FOREIGN KEY ("finalized_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revaluations" ADD CONSTRAINT "revaluations_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revaluations" ADD CONSTRAINT "revaluations_entered_by_fkey" FOREIGN KEY ("entered_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revaluations" ADD CONSTRAINT "revaluations_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
