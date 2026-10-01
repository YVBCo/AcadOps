-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'FIRST_YEAR_COORDINATOR';

-- CreateTable
CREATE TABLE "cycle_department_allocations" (
    "id" SERIAL NOT NULL,
    "batch_id" INTEGER NOT NULL,
    "opted_department_id" INTEGER NOT NULL,
    "semester1_cycle_id" INTEGER NOT NULL,
    "allocated_by" INTEGER NOT NULL,
    "allocated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_locked" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cycle_department_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cycle_department_allocations_batch_id_opted_department_id_key" ON "cycle_department_allocations"("batch_id", "opted_department_id");

-- AddForeignKey
ALTER TABLE "cycle_department_allocations" ADD CONSTRAINT "cycle_department_allocations_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_department_allocations" ADD CONSTRAINT "cycle_department_allocations_opted_department_id_fkey" FOREIGN KEY ("opted_department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_department_allocations" ADD CONSTRAINT "cycle_department_allocations_semester1_cycle_id_fkey" FOREIGN KEY ("semester1_cycle_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_department_allocations" ADD CONSTRAINT "cycle_department_allocations_allocated_by_fkey" FOREIGN KEY ("allocated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
