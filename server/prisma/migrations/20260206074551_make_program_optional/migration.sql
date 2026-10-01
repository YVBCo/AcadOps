-- DropForeignKey
ALTER TABLE "student_profiles" DROP CONSTRAINT "student_profiles_program_id_fkey";

-- AlterTable
ALTER TABLE "student_profiles" ALTER COLUMN "program_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
