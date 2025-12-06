/*
  Warnings:

  - Made the column `idempotencyKey` on table `Task` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Task" ALTER COLUMN "idempotencyKey" SET NOT NULL;
