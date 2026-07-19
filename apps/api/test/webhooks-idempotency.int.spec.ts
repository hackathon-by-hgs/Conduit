import 'reflect-metadata';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '../src/generated/prisma/client';
import { WebhooksRepository } from '../src/modules/webhooks/webhooks.repository';
import type { PrismaService } from '../src/common/prisma/prisma.service';

/**
 * Critical test #1 — the headline correctness guarantee.
 * Fire the same webhook twice concurrently → exactly one event row is stored, and the
 * second call reports `duplicate: true`. Exercises the real WebhooksRepository against
 * a live Postgres, so the DB unique constraint (not app-level check-then-insert) is
 * what enforces idempotency under the race.
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const repo = new WebhooksRepository(prisma as unknown as PrismaService);

const KEY = `__it_dup__${process.pid}_${Date.now()}`;

afterAll(async () => {
  await prisma.webhookEvent.deleteMany({ where: { idempotencyKey: KEY } });
  await prisma.$disconnect();
});

describe('Webhook idempotency (critical test #1)', () => {
  it('stores exactly one row and flags the second concurrent insert as a duplicate', async () => {
    const payload = { id: KEY, type: 'charge.succeeded', amount: 999 };

    const [a, b] = await Promise.all([
      repo.createIfNew({ source: 'itest', type: 'charge.succeeded', idempotencyKey: KEY, payload }),
      repo.createIfNew({ source: 'itest', type: 'charge.succeeded', idempotencyKey: KEY, payload }),
    ]);

    const count = await prisma.webhookEvent.count({ where: { idempotencyKey: KEY } });
    expect(count).toBe(1);

    // Both calls resolve to the same stored event…
    expect(a.event.id).toBe(b.event.id);
    // …and exactly one of them is the duplicate.
    expect([a.duplicate, b.duplicate].sort()).toEqual([false, true]);
  });
});
