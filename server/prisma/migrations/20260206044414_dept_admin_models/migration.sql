/*
  Warnings:

  - A unique constraint covering the columns `[program_id,batch_id,name]` on the table `sections` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "sections_program_id_name_key";

-- AlterTable
ALTER TABLE "attendances" ADD COLUMN     "edit_reason" TEXT,
ADD COLUMN     "is_locked" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "sections" ADD COLUMN     "batch_id" INTEGER,
ADD COLUMN     "is_locked" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "internal_assessment_configs" (
    "id" SERIAL NOT NULL,
    "course_id" INTEGER NOT NULL,
    "semester_number" INTEGER NOT NULL,
    "num_internals" INTEGER NOT NULL DEFAULT 3,
    "max_marks_per_internal" INTEGER NOT NULL DEFAULT 30,
    "assignment_marks" INTEGER NOT NULL DEFAULT 20,
    "total_marks" INTEGER NOT NULL DEFAULT 50,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internal_assessment_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_marks_details" (
    "id" SERIAL NOT NULL,
    "student_usn" TEXT NOT NULL,
    "course_id" INTEGER NOT NULL,
    "batch_id" INTEGER NOT NULL,
    "section_id" INTEGER NOT NULL,
    "internal_1" DOUBLE PRECISION,
    "internal_2" DOUBLE PRECISION,
    "internal_3" DOUBLE PRECISION,
    "assignment_marks" DOUBLE PRECISION,
    "calculated_total" DOUBLE PRECISION,
    "is_finalized" BOOLEAN NOT NULL DEFAULT false,
    "edit_reason" TEXT,
    "updated_by" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "internal_marks_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_allocations" (
    "id" SERIAL NOT NULL,
    "course_id" INTEGER NOT NULL,
    "section_id" INTEGER NOT NULL,
    "semester_number" INTEGER NOT NULL,
    "teacher_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_time_slot_configs" (
    "id" SERIAL NOT NULL,
    "department_id" INTEGER NOT NULL,
    "slot_duration" INTEGER NOT NULL DEFAULT 60,
    "day_start_time" TEXT NOT NULL DEFAULT '09:00',
    "day_end_time" TEXT NOT NULL DEFAULT '17:00',
    "break_slots" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "department_time_slot_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "section_timetables" (
    "id" SERIAL NOT NULL,
    "section_id" INTEGER NOT NULL,
    "semester_id" INTEGER NOT NULL,
    "semester_number" INTEGER NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "uploaded_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "section_timetables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "internal_assessment_configs_course_id_semester_number_key" ON "internal_assessment_configs"("course_id", "semester_number");

-- CreateIndex
CREATE INDEX "internal_marks_details_section_id_idx" ON "internal_marks_details"("section_id");

-- CreateIndex
CREATE INDEX "internal_marks_details_batch_id_idx" ON "internal_marks_details"("batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "internal_marks_details_student_usn_course_id_batch_id_key" ON "internal_marks_details"("student_usn", "course_id", "batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_allocations_course_id_section_id_semester_number_key" ON "course_allocations"("course_id", "section_id", "semester_number");

-- CreateIndex
CREATE UNIQUE INDEX "department_time_slot_configs_department_id_key" ON "department_time_slot_configs"("department_id");

-- CreateIndex
CREATE UNIQUE INDEX "section_timetables_section_id_semester_id_key" ON "section_timetables"("section_id", "semester_id");

-- CreateIndex
CREATE UNIQUE INDEX "sections_program_id_batch_id_name_key" ON "sections"("program_id", "batch_id", "name");

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_assessment_configs" ADD CONSTRAINT "internal_assessment_configs_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_marks_details" ADD CONSTRAINT "internal_marks_details_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_marks_details" ADD CONSTRAINT "internal_marks_details_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_marks_details" ADD CONSTRAINT "internal_marks_details_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_marks_details" ADD CONSTRAINT "internal_marks_details_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_allocations" ADD CONSTRAINT "course_allocations_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_allocations" ADD CONSTRAINT "course_allocations_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_allocations" ADD CONSTRAINT "course_allocations_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teacher_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_time_slot_configs" ADD CONSTRAINT "department_time_slot_configs_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_timetables" ADD CONSTRAINT "section_timetables_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_timetables" ADD CONSTRAINT "section_timetables_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_timetables" ADD CONSTRAINT "section_timetables_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
