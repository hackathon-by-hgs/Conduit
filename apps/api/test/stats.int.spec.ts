import 'reflect-metadata';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '../src/generated/prisma/client';
import { WebhooksRepository } from '../src/modules/webhooks/webhooks.repository';
import { StatsRepository } from '../src/modules/stats/stats.repository';
import type { PrismaService } from '../src/common/prisma/prisma.service';

/**
 * `duplicatesRejected` is the demo's headline correctness number ("processed once, not
 * twice"), so it has to be a real measurement rather than a constant. Every re-delivery
 * rejected by the idempotency constraint increments a counter on the ORIGINAL event, and
 * /stats sums those counters.
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const webhooks = new WebhooksRepository(prisma as unknown as PrismaService);
const stats = new StatsRepository(prisma as unknown as PrismaService);

const KEY = `__it_stats__${process.pid}_${Date.now()}`;

afterAll(async () => {
  await prisma.webhookEvent.deleteMany({ where: { idempotencyKey: KEY } });
  await prisma.$disconnect();
});

describe('Stats · duplicatesRejected', () => {
  it('counts every rejected re-delivery, including concurrent ones', async () => {
    const payload = { id: KEY, type: 'charge.succeeded' };
    const ingest = () =>
      webhooks.createIfNew({
        source: 'itest',
        type: 'charge.succeeded',
        idempotencyKey: KEY,
        payload,
      });

    const before = await stats.counts();

    // One genuine delivery, then three retries from the provider.
    const first = await ingest();
    expect(first.duplicate).toBe(false);
    await ingest();
    // Concurrent re-deliveries must not lose increments (atomic `increment`, not read-modify-write).
    await Promise.all([ingest(), ingest()]);

    const event = await prisma.webhookEvent.findUniqueOrThrow({ where: { id: first.event.id } });
    expect(event.duplicateCount).toBe(3);

    // Exactly one row was ever stored, and the delta on the aggregate matches.
    expect(await prisma.webhookEvent.count({ where: { idempotencyKey: KEY } })).toBe(1);
    const after = await stats.counts();
    expect(after.duplicatesRejected - before.duplicatesRejected).toBe(3);
    expect(after.eventsReceived - before.eventsReceived).toBe(1);
  });
});
