import 'reflect-metadata';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '../src/generated/prisma/client';
import { WebhooksRepository } from '../src/modules/webhooks/webhooks.repository';
import { OutboxRepository } from '../src/outbox/outbox.repository';
import type { PrismaService } from '../src/common/prisma/prisma.service';

/**
 * Reliability backbone — transactional outbox.
 * 1. Atomicity: ingest writes the event AND its outbox row in one transaction.
 * 2. Deadlock-free claim: concurrent drains claim DISJOINT rows via FOR UPDATE SKIP LOCKED —
 *    no row dispatched twice, no deadlock (40P01).
 * 3. Crash-safety: a dispatch failure leaves the row `pending`; a re-drain picks it up.
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const webhooks = new WebhooksRepository(prisma as unknown as PrismaService);
const outbox = new OutboxRepository(prisma as unknown as PrismaService);

const SOURCE = `itest_outbox_${process.pid}_${Date.now()}`;

afterAll(async () => {
  await prisma.webhookEvent.deleteMany({ where: { source: SOURCE } }); // cascades outbox rows
  await prisma.$disconnect();
});

async function ingest(n: number): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const { event } = await webhooks.createIfNew({
      source: SOURCE,
      type: 't',
      idempotencyKey: `${SOURCE}_${i}`,
      payload: { i },
    });
    ids.push(event.id);
  }
  return ids;
}

describe('Transactional outbox', () => {
  it('writes the event and its outbox row atomically', async () => {
    const [eventId] = await ingest(1);
    const rows = await prisma.outboxJob.findMany({ where: { eventId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('pending');
  });

  it('claims disjoint rows under concurrency (no double-dispatch, no deadlock)', async () => {
    await ingest(10);
    const before = await prisma.outboxJob.count({ where: { event: { source: SOURCE }, status: 'pending' } });
    expect(before).toBeGreaterThanOrEqual(10);

    const dispatchedA: string[] = [];
    const dispatchedB: string[] = [];
    // Two concurrent drainers, small batch so they split the work.
    const [a, b] = await Promise.all([
      outbox.drainBatch(4, (r) => {
        dispatchedA.push(r.id);
        return Promise.resolve();
      }),
      outbox.drainBatch(4, (r) => {
        dispatchedB.push(r.id);
        return Promise.resolve();
      }),
    ]);

    // No id dispatched by both drainers.
    const overlap = dispatchedA.filter((id) => dispatchedB.includes(id));
    expect(overlap).toHaveLength(0);
    expect(a).toBe(dispatchedA.length);
    expect(b).toBe(dispatchedB.length);

    // Everything they claimed is now marked dispatched exactly once.
    const claimed = [...dispatchedA, ...dispatchedB];
    const stillPending = await prisma.outboxJob.count({
      where: { id: { in: claimed }, status: 'pending' },
    });
    expect(stillPending).toBe(0);
  });

  it('leaves a row pending when dispatch fails, and re-dispatches it next drain', async () => {
    await ingest(1);
    // Fail on the first row of this source that is still pending.
    let failedId: string | null = null;
    await expect(
      outbox.drainBatch(1, (r) => {
        failedId = r.id;
        return Promise.reject(new Error('boom'));
      }),
    ).rejects.toThrow('boom');

    expect(failedId).not.toBeNull();
    const afterFail = await prisma.outboxJob.findUniqueOrThrow({ where: { id: failedId! } });
    expect(afterFail.status).toBe('pending'); // rolled back, not lost

    // Re-drain succeeds and marks it dispatched.
    await outbox.drainBatch(50, () => Promise.resolve());
    const afterRetry = await prisma.outboxJob.findUniqueOrThrow({ where: { id: failedId! } });
    expect(afterRetry.status).toBe('dispatched');
  });
});
