-- AlterTable
ALTER TABLE "attempts" ADD COLUMN     "providerId" TEXT;

-- AlterTable
ALTER TABLE "sends" ADD COLUMN     "attemptBudget" INTEGER NOT NULL DEFAULT 5;

-- AlterTable
ALTER TABLE "webhook_events" ADD COLUMN     "duplicateCount" INTEGER NOT NULL DEFAULT 0;
