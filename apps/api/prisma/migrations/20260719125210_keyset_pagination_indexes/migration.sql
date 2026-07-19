-- DropIndex
DROP INDEX "sends_status_createdAt_idx";

-- DropIndex
DROP INDEX "webhook_events_source_receivedAt_idx";

-- DropIndex
DROP INDEX "webhook_events_status_receivedAt_idx";

-- CreateIndex
CREATE INDEX "sends_status_createdAt_id_idx" ON "sends"("status", "createdAt", "id");

-- CreateIndex
CREATE INDEX "webhook_events_status_receivedAt_id_idx" ON "webhook_events"("status", "receivedAt", "id");

-- CreateIndex
CREATE INDEX "webhook_events_source_receivedAt_id_idx" ON "webhook_events"("source", "receivedAt", "id");
