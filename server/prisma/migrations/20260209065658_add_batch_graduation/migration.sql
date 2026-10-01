-- AlterTable
ALTER TABLE "batches" ADD COLUMN     "graduated_at" TIMESTAMP(3),
ADD COLUMN     "is_graduated" BOOLEAN NOT NULL DEFAULT false;
