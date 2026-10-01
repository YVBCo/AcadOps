/*
  Warnings:

  - A unique constraint covering the columns `[temporary_usn]` on the table `student_profiles` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[permanent_usn]` on the table `student_profiles` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[admission_id]` on the table `student_profiles` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "AdmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRole" ADD VALUE 'ADMISSIONS_ADMIN';
ALTER TYPE "UserRole" ADD VALUE 'ADMIN_CLERK';

-- AlterTable
ALTER TABLE "student_profiles" ADD COLUMN     "admission_id" TEXT,
ADD COLUMN     "is_permanent_usn_locked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "permanent_usn" TEXT,
ADD COLUMN     "temporary_usn" TEXT;

-- CreateTable
CREATE TABLE "admission_data" (
    "id" SERIAL NOT NULL,
    "admission_id" TEXT NOT NULL,
    "student_profile_id" INTEGER,
    "status" "AdmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "rejection_reason" TEXT,
    "applying_through" TEXT,
    "applicant_name" TEXT NOT NULL,
    "gender" TEXT,
    "blood_group" TEXT,
    "date_of_birth" TIMESTAMP(3),
    "nationality" TEXT,
    "religion" TEXT,
    "category" TEXT,
    "sub_caste" TEXT,
    "mother_tongue" TEXT,
    "specially_abled" BOOLEAN NOT NULL DEFAULT false,
    "aadhaar_number" TEXT,
    "email_id" TEXT,
    "mobile_number" TEXT,
    "hostel" BOOLEAN NOT NULL DEFAULT false,
    "pickup_place" TEXT,
    "permanent_address" JSONB,
    "local_address" JSONB,
    "father_details" JSONB,
    "mother_details" JSONB,
    "branch_selection" TEXT,
    "cet_roll_no" TEXT,
    "cet_rank" TEXT,
    "cet_allotted_category" TEXT,
    "comedk_roll_no" TEXT,
    "comedk_rank" TEXT,
    "sslc_details" JSONB,
    "puc_details" JSONB,
    "subject_wise_marks" JSONB,
    "documents" JSONB,
    "how_did_you_know" TEXT,
    "applicant_declaration" BOOLEAN NOT NULL DEFAULT false,
    "parent_declaration" BOOLEAN NOT NULL DEFAULT false,
    "entered_by" INTEGER NOT NULL,
    "approved_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admission_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usn_requests" (
    "id" SERIAL NOT NULL,
    "student_profile_id" INTEGER NOT NULL,
    "requested_by" INTEGER NOT NULL,
    "permanent_usn" TEXT,
    "status" "EditRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "reviewed_by" INTEGER,
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "usn_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admission_data_admission_id_key" ON "admission_data"("admission_id");

-- CreateIndex
CREATE UNIQUE INDEX "admission_data_student_profile_id_key" ON "admission_data"("student_profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_temporary_usn_key" ON "student_profiles"("temporary_usn");

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_permanent_usn_key" ON "student_profiles"("permanent_usn");

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_admission_id_key" ON "student_profiles"("admission_id");

-- AddForeignKey
ALTER TABLE "admission_data" ADD CONSTRAINT "admission_data_student_profile_id_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_data" ADD CONSTRAINT "admission_data_entered_by_fkey" FOREIGN KEY ("entered_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_data" ADD CONSTRAINT "admission_data_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usn_requests" ADD CONSTRAINT "usn_requests_student_profile_id_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usn_requests" ADD CONSTRAINT "usn_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usn_requests" ADD CONSTRAINT "usn_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
