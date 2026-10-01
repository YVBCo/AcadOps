/*
  Warnings:

  - You are about to drop the column `program_id` on the `sections` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[department_id,batch_id,name]` on the table `sections` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `department_id` to the `sections` table without a default value. This is not possible if the table is not empty.
  - Made the column `batch_id` on table `sections` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "sections" DROP CONSTRAINT "sections_batch_id_fkey";

-- DropForeignKey
ALTER TABLE "sections" DROP CONSTRAINT "sections_program_id_fkey";

-- DropIndex
DROP INDEX "sections_program_id_batch_id_name_key";

-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "is_cycle_department" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "sections" DROP COLUMN "program_id",
ADD COLUMN     "department_id" INTEGER NOT NULL,
ALTER COLUMN "batch_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "student_profiles" ADD COLUMN     "cycle_department_id" INTEGER,
ADD COLUMN     "opted_department_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "sections_department_id_batch_id_name_key" ON "sections"("department_id", "batch_id", "name");

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_cycle_department_id_fkey" FOREIGN KEY ("cycle_department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_opted_department_id_fkey" FOREIGN KEY ("opted_department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
