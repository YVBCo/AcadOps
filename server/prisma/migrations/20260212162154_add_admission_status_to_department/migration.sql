-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "admission_closed_at" TIMESTAMP(3),
ADD COLUMN     "is_admission_open" BOOLEAN NOT NULL DEFAULT true;
