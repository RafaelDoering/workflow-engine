-- AlterEnum
ALTER TYPE "WorkflowInstanceStatus" ADD VALUE 'DEAD_LETTER';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "compensationAttempt" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "maxCompensationAttempts" INTEGER NOT NULL DEFAULT 3;
