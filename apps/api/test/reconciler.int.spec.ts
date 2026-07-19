import 'reflect-metadata';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '../src/generated/prisma/client';
import { ReconciliationRepository } from '../src/modules/reconciliation/reconciliation.repository';
import { ReconciliationService } from '../src/modules/reconciliation/reconciliation.service';
import type { PrismaService } from '../src/common/prisma/prisma.service';

/**
 * Critical test #2 — the reconciler is the product's differentiator.
 * Delete the only send of a processed event → the reconciler emits a `no_send` gap on its
 * next run (and does not re-emit it on the run after). Exercises the real reconciler logic
 * against a live Postgres. Assertions are scoped to this test's own event id, so it is
 * independent of seed data.
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const repo = new ReconciliationRepository(prisma as unknown as PrismaService);
const service = new ReconciliationService(repo);

const TAG = `__it_recon__${process.pid}_${Date.now()}`;

afterAll(async () => {
  const events = await prisma.webhookEvent.findMany({
    where: { idempotencyKey: TAG },
    select: { id: true },
  });
  const ids = events.map((e) => e.id);
  await prisma.reconcileGap.deleteMany({ where: { eventId: { in: ids } } });
  await prisma.webhookEvent.deleteMany({ where: { idempotencyKey: TAG } }); // cascades sends
  await prisma.$disconnect();
});

describe('Reconciler no_send gap (critical test #2)', () => {
  it('flags a processed event whose only send is deleted, exactly once', async () => {
    // A processed event with one delivered (terminal) send → invariant holds for it.
    const event = await prisma.webhookEvent.create({
      data: { source: 'itest', type: 't', idempotencyKey: TAG, status: 'processed', payload: {} },
    });
    const send = await prisma.send.create({
      data: {
        causedBy: event.id,
        channel: 'email',
        to: 'x@example.com',
        payload: {},
        status: 'sent',
        deliveredAt: new Date(),
      },
    });

    // Before injection: no no_send gap for this event.
    await service.runReconciler();
    expect(
      await prisma.reconcileGap.count({ where: { eventId: event.id, type: 'no_send' } }),
    ).toBe(0);

    // Inject the failure: delete the send.
    await prisma.send.delete({ where: { id: send.id } });

    // Next run: exactly one no_send gap is emitted for this event.
    const result = await service.runReconciler();
    expect(result.created).toBeGreaterThanOrEqual(1);
    expect(
      await prisma.reconcileGap.findMany({ where: { eventId: event.id, type: 'no_send' } }),
    ).toHaveLength(1);
    expect(result.report.invariantHolds).toBe(false);

    // Idempotent: a subsequent run does not duplicate the gap.
    await service.runReconciler();
    expect(
      await prisma.reconcileGap.count({ where: { eventId: event.id, type: 'no_send' } }),
    ).toBe(1);
  });
});
