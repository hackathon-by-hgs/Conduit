-- AlterTable
ALTER TABLE "sends" ADD COLUMN     "idempotencyKey" TEXT;

-- CreateIndex
-- Postgres treats NULLs as distinct in a unique index, so the sends the worker creates
-- automatically (which leave this null) are unaffected; only explicit `POST /sends` calls
-- carry a key, and a repeat of one collides here and returns the original send.
CREATE UNIQUE INDEX "sends_idempotencyKey_key" ON "sends"("idempotencyKey");
