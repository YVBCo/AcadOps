/*
  Warnings:

  - You are about to drop the column `department_id` on the `programs` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'COE';

-- DropForeignKey
ALTER TABLE "programs" DROP CONSTRAINT "programs_department_id_fkey";

-- AlterTable
ALTER TABLE "programs" DROP COLUMN "department_id";

-- CreateTable
CREATE TABLE "_DepartmentToProgram" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_DepartmentToProgram_AB_unique" ON "_DepartmentToProgram"("A", "B");

-- CreateIndex
CREATE INDEX "_DepartmentToProgram_B_index" ON "_DepartmentToProgram"("B");

-- AddForeignKey
ALTER TABLE "_DepartmentToProgram" ADD CONSTRAINT "_DepartmentToProgram_A_fkey" FOREIGN KEY ("A") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DepartmentToProgram" ADD CONSTRAINT "_DepartmentToProgram_B_fkey" FOREIGN KEY ("B") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
