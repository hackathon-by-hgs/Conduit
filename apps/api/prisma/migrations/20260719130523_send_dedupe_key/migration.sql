-- AlterTable
ALTER TABLE "sends" ADD COLUMN     "dedupeKey" TEXT;
-- CreateIndex
CREATE INDEX "sends_dedupeKey_createdAt_idx" ON "sends"("dedupeKey", "createdAt");
