-- CreateEnum
CREATE TYPE "MentorApprovalStatus" AS ENUM ('DRAFT', 'SUBMITTED_BY_TEACHER', 'APPROVED_BY_MENTOR', 'MENTOR_EDIT_PENDING_APPROVAL', 'REJECTED_BY_MENTOR');

-- CreateEnum
CREATE TYPE "InteractionMode" AS ENUM ('CALL', 'MEETING');

-- CreateEnum
CREATE TYPE "InteractionPurpose" AS ENUM ('ATTENDANCE', 'IA_MARKS', 'BEHAVIOR', 'OTHER');

-- CreateEnum
CREATE TYPE "OverallAssessment" AS ENUM ('SATISFACTORY', 'MODERATE', 'NEEDS_IMPROVEMENT');

-- AlterTable
ALTER TABLE "internal_marks_details" ADD COLUMN     "mentor_approval_status" "MentorApprovalStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "mentor_approved_at" TIMESTAMP(3),
ADD COLUMN     "mentor_approved_by" INTEGER,
ADD COLUMN     "mentor_rejection_reason" TEXT;

-- CreateTable
CREATE TABLE "mentor_assignments" (
    "id" SERIAL NOT NULL,
    "teacher_profile_id" INTEGER NOT NULL,
    "student_profile_id" INTEGER NOT NULL,
    "department_id" INTEGER NOT NULL,
    "batch_id" INTEGER NOT NULL,
    "section_id" INTEGER NOT NULL,
    "academic_year" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" INTEGER NOT NULL,
    "expired_at" TIMESTAMP(3),

    CONSTRAINT "mentor_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_observations" (
    "id" SERIAL NOT NULL,
    "mentor_assignment_id" INTEGER NOT NULL,
    "academic_year" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "personality_communication" TEXT,
    "curricular_response" TEXT,
    "co_curricular_response" TEXT,
    "extra_curricular_response" TEXT,
    "overall_assessment" "OverallAssessment" NOT NULL,
    "mentor_remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mentor_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_student_interactions" (
    "id" SERIAL NOT NULL,
    "mentor_assignment_id" INTEGER NOT NULL,
    "meeting_number" INTEGER NOT NULL,
    "personal_aspects" TEXT,
    "academic_aspects" TEXT,
    "career_aspects" TEXT,
    "other_aspects" TEXT,
    "interaction_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentor_student_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_parent_interactions" (
    "id" SERIAL NOT NULL,
    "mentor_assignment_id" INTEGER NOT NULL,
    "interaction_date" TIMESTAMP(3) NOT NULL,
    "mode" "InteractionMode" NOT NULL,
    "purpose" "InteractionPurpose" NOT NULL,
    "summary" TEXT NOT NULL,
    "mentor_signature" BOOLEAN NOT NULL DEFAULT false,
    "hod_signature" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentor_parent_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mentor_assignments_teacher_profile_id_is_active_idx" ON "mentor_assignments"("teacher_profile_id", "is_active");

-- CreateIndex
CREATE INDEX "mentor_assignments_department_id_batch_id_section_id_idx" ON "mentor_assignments"("department_id", "batch_id", "section_id");

-- CreateIndex
CREATE UNIQUE INDEX "mentor_assignments_student_profile_id_academic_year_semeste_key" ON "mentor_assignments"("student_profile_id", "academic_year", "semester");

-- CreateIndex
CREATE UNIQUE INDEX "mentor_observations_mentor_assignment_id_academic_year_seme_key" ON "mentor_observations"("mentor_assignment_id", "academic_year", "semester");

-- CreateIndex
CREATE INDEX "internal_marks_details_mentor_approval_status_idx" ON "internal_marks_details"("mentor_approval_status");

-- AddForeignKey
ALTER TABLE "internal_marks_details" ADD CONSTRAINT "internal_marks_details_mentor_approved_by_fkey" FOREIGN KEY ("mentor_approved_by") REFERENCES "teacher_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_assignments" ADD CONSTRAINT "mentor_assignments_teacher_profile_id_fkey" FOREIGN KEY ("teacher_profile_id") REFERENCES "teacher_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_assignments" ADD CONSTRAINT "mentor_assignments_student_profile_id_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_assignments" ADD CONSTRAINT "mentor_assignments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_assignments" ADD CONSTRAINT "mentor_assignments_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_assignments" ADD CONSTRAINT "mentor_assignments_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_assignments" ADD CONSTRAINT "mentor_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_observations" ADD CONSTRAINT "mentor_observations_mentor_assignment_id_fkey" FOREIGN KEY ("mentor_assignment_id") REFERENCES "mentor_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_student_interactions" ADD CONSTRAINT "mentor_student_interactions_mentor_assignment_id_fkey" FOREIGN KEY ("mentor_assignment_id") REFERENCES "mentor_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_parent_interactions" ADD CONSTRAINT "mentor_parent_interactions_mentor_assignment_id_fkey" FOREIGN KEY ("mentor_assignment_id") REFERENCES "mentor_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
