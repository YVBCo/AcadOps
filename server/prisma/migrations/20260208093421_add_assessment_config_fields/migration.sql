/*
  Warnings:

  - You are about to drop the column `assignment_marks` on the `internal_assessment_configs` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "internal_assessment_configs" DROP COLUMN "assignment_marks",
ADD COLUMN     "assignment_weightage" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "has_assignment" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "has_lab" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "internal_weightage" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "internals_to_consider" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "lab_weightage" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "max_assignment_marks" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "max_lab_marks" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "num_assignments" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "num_lab_exams" INTEGER NOT NULL DEFAULT 0;
