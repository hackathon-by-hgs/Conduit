import 'reflect-metadata';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { StreamEvent } from '@conduit/contracts';
import { PrismaClient } from '../src/generated/prisma/client';
import { ReconciliationRepository } from '../src/modules/reconciliation/reconciliation.repository';
import { ReconciliationService } from '../src/modules/reconciliation/reconciliation.service';
import type { AppConfigService } from '../src/config/config.service';
import type { StreamService } from '../src/modules/stream/stream.service';
import type { PrismaService } from '../src/common/prisma/prisma.service';

/**
 * The reconciler is the product's differentiator, so it gets the deepest coverage:
 * - critical test #2: delete the only send of a processed event → a `no_send` gap appears
 *   on the next run, and is NOT duplicated on the run after.
 * - `orphan_send`: a terminal send whose event was never marked processed.
 * - resolution: once the underlying violation is repaired, the open gap is closed, the
 *   invariant returns to green, and the change is broadcast on the stream.
 *
 * Assertions are scoped to each test's own event ids, so the suite is independent of any
 * seed data already in the database.
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const repo = new ReconciliationRepository(prisma as unknown as PrismaService);

/**
 * `reconcileIntervalMs` is only read from onModuleInit (never called here). The grace
 * period is 0 so the tests assert detection deterministically rather than racing a clock;
 * the grace period itself is covered by its own test below.
 */
const config = {
  reconcileIntervalMs: 30_000,
  reconcileNoSendGraceMs: 0,
  reconcileStuckAfterMs: 300_000,
} as AppConfigService;

const published: StreamEvent[] = [];
/** Only `publish` is exercised; the SSE plumbing itself is not under test here. */
const stream = {
  publish: (e: StreamEvent) => {
    published.push(e);
  },
} as unknown as StreamService;

const service = new ReconciliationService(repo, config, stream);

/** A reconciler with a real grace period, for the in-flight-suppression test. */
const gracefulService = new ReconciliationService(
  repo,
  { ...config, reconcileNoSendGraceMs: 60_000 } as AppConfigService,
  stream,
);

const TAG = `__it_recon__${process.pid}_${Date.now()}`;
let seq = 0;

/** Every event this suite creates is tagged so cleanup and scoping are exact. */
function makeEvent(status: string, extra: Record<string, unknown> = {}) {
  return prisma.webhookEvent.create({
    data: {
      source: 'itest',
      type: 't',
      idempotencyKey: `${TAG}_${seq++}`,
      status,
      payload: {},
      ...extra,
    },
  });
}

beforeEach(() => {
  published.length = 0;
});

afterAll(async () => {
  const events = await prisma.webhookEvent.findMany({
    where: { idempotencyKey: { startsWith: TAG } },
    select: { id: true },
  });
  const ids = events.map((e) => e.id);
  await prisma.reconcileGap.deleteMany({ where: { eventId: { in: ids } } });
  await prisma.webhookEvent.deleteMany({ where: { idempotencyKey: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe('Reconciler', () => {
  it('flags a processed event whose only send is deleted, exactly once (critical test #2)', async () => {
    // A processed event with one delivered (terminal) send → the invariant holds for it.
    const event = await makeEvent('processed');
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

    await service.runReconciler();
    expect(
      await prisma.reconcileGap.count({ where: { eventId: event.id, type: 'no_send' } }),
    ).toBe(0);

    // Inject the failure: delete the send.
    await prisma.send.delete({ where: { id: send.id } });

    const result = await service.runReconciler();
    expect(result.created).toBeGreaterThanOrEqual(1);
    expect(
      await prisma.reconcileGap.findMany({ where: { eventId: event.id, type: 'no_send' } }),
    ).toHaveLength(1);
    expect(result.report.invariantHolds).toBe(false);
    expect(result.report.lastRunAt).not.toBeNull();
    // A change to the gap set is broadcast so the dashboard refetches.
    expect(published.some((e) => e.kind === 'gap.detected')).toBe(true);

    // Idempotent: a subsequent run does not duplicate the gap.
    await service.runReconciler();
    expect(
      await prisma.reconcileGap.count({ where: { eventId: event.id, type: 'no_send' } }),
    ).toBe(1);
  });

  it('detects an orphan_send: a delivered send whose event was never marked processed', async () => {
    // `received`, not `processed` — an outbound effect with no settled inbound cause.
    const event = await makeEvent('received');
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

    await service.runReconciler();

    const gaps = await prisma.reconcileGap.findMany({
      where: { eventId: event.id, type: 'orphan_send' },
    });
    expect(gaps).toHaveLength(1);
    expect(gaps[0]?.sendId).toBe(send.id);
    expect(gaps[0]?.resolvedAt).toBeNull();
  });

  it('resolves an open gap once the underlying violation is repaired', async () => {
    const event = await makeEvent('received');
    await prisma.send.create({
      data: {
        causedBy: event.id,
        channel: 'email',
        to: 'x@example.com',
        payload: {},
        status: 'sent',
        deliveredAt: new Date(),
      },
    });

    await service.runReconciler();
    const opened = await prisma.reconcileGap.findFirstOrThrow({
      where: { eventId: event.id, type: 'orphan_send' },
    });
    expect(opened.resolvedAt).toBeNull();

    // Repair it: the event really was processed after all.
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: { status: 'processed', processedAt: new Date() },
    });

    const result = await service.runReconciler();
    expect(result.resolved).toBeGreaterThanOrEqual(1);

    const closed = await prisma.reconcileGap.findUniqueOrThrow({ where: { id: opened.id } });
    expect(closed.resolvedAt).not.toBeNull();

    // The gap is history now, so a report scoped to open gaps shows the invariant green.
    const openReport = await service.getReport({ status: 'open' });
    expect(openReport.gaps.some((g) => g.eventId === event.id)).toBe(false);
    expect(openReport.summary.open).toBe(openReport.gaps.length);
  });

  /**
   * Regression: an event is marked `processed` the moment its send row is created, so a
   * delivery that is merely still in flight briefly looks like "processed with no terminal
   * send". Without a grace period the reconciler emitted a gap for every single in-flight
   * delivery, which then resolved itself seconds later — pure noise that devalues real gaps.
   */
  it('does not flag an in-flight delivery within the no_send grace period', async () => {
    const event = await makeEvent('processed', { processedAt: new Date() });
    await prisma.send.create({
      data: {
        causedBy: event.id,
        channel: 'email',
        to: 'x@e.com',
        payload: {},
        status: 'pending', // still being delivered — not terminal yet
      },
    });

    await gracefulService.runReconciler();
    expect(await prisma.reconcileGap.count({ where: { eventId: event.id } })).toBe(0);

    // Once the grace period has elapsed (grace = 0 here), it IS a genuine gap.
    await service.runReconciler();
    expect(
      await prisma.reconcileGap.count({ where: { eventId: event.id, type: 'no_send' } }),
    ).toBe(1);
  });

  /**
   * Regression: near-duplicate dedupe intentionally collapses one event's delivery into an
   * earlier identical send, leaving that event `processed` with no send of its own. That is
   * correct behaviour, but it used to be reported as a permanent `no_send` gap that could
   * never resolve.
   */
  it('does not flag an event whose delivery was deliberately collapsed into another send', async () => {
    const original = await makeEvent('processed', { processedAt: new Date(0) });
    const send = await prisma.send.create({
      data: {
        causedBy: original.id,
        channel: 'email',
        to: 'x@e.com',
        payload: {},
        status: 'sent',
        deliveredAt: new Date(),
      },
    });
    // The collapsed event: processed long ago, no send of its own, but accounted for.
    const collapsed = await makeEvent('processed', {
      processedAt: new Date(0),
      collapsedInto: send.id,
    });

    await service.runReconciler();

    expect(await prisma.reconcileGap.count({ where: { eventId: collapsed.id } })).toBe(0);
  });

  it('does not reopen a resolved gap, and reports the open/resolved split', async () => {
    const event = await makeEvent('received');
    await prisma.send.create({
      data: { causedBy: event.id, channel: 'email', to: 'x@e.com', payload: {}, status: 'sent' },
    });

    await service.runReconciler(); // opens orphan_send
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: { status: 'processed', processedAt: new Date() },
    });
    await service.runReconciler(); // resolves it
    await service.runReconciler(); // must be a no-op for this event

    const gaps = await prisma.reconcileGap.findMany({ where: { eventId: event.id } });
    expect(gaps).toHaveLength(1);
    expect(gaps[0]?.resolvedAt).not.toBeNull();

    const report = await service.getReport({});
    expect(report.summary.open + report.summary.resolved).toBe(report.summary.total);
    expect(report.summary.total).toBe(report.gaps.length);
  });
});
