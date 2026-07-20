-- Dedupe existing OPEN gaps before adding the constraint (NULL-safe, keeps one per key).
DELETE FROM "reconcile_gaps" a
USING "reconcile_gaps" b
WHERE a."resolvedAt" IS NULL
  AND b."resolvedAt" IS NULL
  AND a.ctid < b.ctid
  AND a."type" = b."type"
  AND a."eventId" IS NOT DISTINCT FROM b."eventId"
  AND a."sendId" IS NOT DISTINCT FROM b."sendId";

-- DB-enforced open-gap uniqueness (partial + NULLS NOT DISTINCT; Postgres 15+).
CREATE UNIQUE INDEX "reconcile_gaps_open_unique"
  ON "reconcile_gaps" ("type", "eventId", "sendId")
  NULLS NOT DISTINCT
  WHERE "resolvedAt" IS NULL;
