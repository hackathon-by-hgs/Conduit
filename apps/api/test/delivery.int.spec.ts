import 'reflect-metadata';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '../src/generated/prisma/client';
import { DeliveryRepository } from '../src/modules/delivery/delivery.repository';
import type { PrismaService } from '../src/common/prisma/prisma.service';

/**
 * Delivery worker primitives (deadlock-free, idempotent):
 * - ensureSend: one send per event even under concurrency (advisory lock per source).
 * - dedup: near-duplicate (same recipient+content) collapses within the window.
 * - recordAttempt: failures escalate pending → failed → dead_lettered; success → sent,
 *   the retry budget comes from the send row, and a non-retryable fault short-circuits.
 * - claimForReplay: a double-click resets a dead-lettered send exactly once (row lock),
 *   and the replayed send gets a fresh attempt budget.
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const repo = new DeliveryRepository(prisma as unknown as PrismaService);

const SOURCE = `itest_delivery_${process.pid}_${Date.now()}`;
let seq = 0;

async function makeEvent(): Promise<string> {
  const e = await prisma.webhookEvent.create({
    data: {
      source: SOURCE,
      type: 't',
      idempotencyKey: `${SOURCE}_${seq++}`,
      payload: { to: 'x@example.com' },
      status: 'received',
    },
  });
  return e.id;
}

const base = {
  source: SOURCE,
  to: 'x@example.com',
  channel: 'email',
  payload: { to: 'x@example.com' } as Record<string, unknown>,
  dedupeWindowMs: 10_000,
  maxAttempts: 5,
};

/** A failing, retryable provider result. */
const failure = {
  ok: false,
  statusCode: 500,
  providerId: null,
  error: 'boom',
  durationMs: 10,
  retryable: true,
  backoffMs: 100,
  backoffCapMs: 60_000,
};

afterAll(async () => {
  await prisma.webhookEvent.deleteMany({ where: { source: SOURCE } }); // cascades sends + attempts
  await prisma.$disconnect();
});

describe('Delivery worker primitives', () => {
  it('ensureSend is idempotent per event', async () => {
    const eventId = await makeEvent();
    const a = await repo.ensureSend({ ...base, eventId, dedupeKey: `k_${eventId}` });
    const b = await repo.ensureSend({ ...base, eventId, dedupeKey: `k_${eventId}` });
    expect(a.status).toBe('created');
    expect(b.status).toBe('resumed');
    expect(b.sendId).toBe(a.sendId);
    expect(await prisma.send.count({ where: { causedBy: eventId } })).toBe(1);
  });

  it('seeds the attempt budget from maxAttempts', async () => {
    const eventId = await makeEvent();
    const { sendId } = await repo.ensureSend({
      ...base,
      eventId,
      dedupeKey: `b_${eventId}`,
      maxAttempts: 3,
    });
    const send = await prisma.send.findUniqueOrThrow({ where: { id: sendId! } });
    expect(send.attemptBudget).toBe(3);
  });

  it('collapses a near-duplicate within the window, but not with a zero window', async () => {
    const key = `dupkey_${Date.now()}`;
    const e1 = await makeEvent();
    const e2 = await makeEvent();
    const r1 = await repo.ensureSend({ ...base, eventId: e1, dedupeKey: key });
    const r2 = await repo.ensureSend({ ...base, eventId: e2, dedupeKey: key });
    expect(r1.status).toBe('created');
    expect(r2.status).toBe('deduped');
    expect(r2.sendId).toBe(r1.sendId);
    expect(await prisma.send.count({ where: { causedBy: e2 } })).toBe(0);

    const e3 = await makeEvent();
    const r3 = await repo.ensureSend({ ...base, eventId: e3, dedupeKey: key, dedupeWindowMs: 0 });
    expect(r3.status).toBe('created');
    expect(r3.sendId).not.toBe(r1.sendId);
  });

  it('recordAttempt escalates failures to dead_lettered, and succeeds cleanly', async () => {
    const failEvent = await makeEvent();
    const { sendId } = await repo.ensureSend({
      ...base,
      eventId: failEvent,
      dedupeKey: `f_${failEvent}`,
      maxAttempts: 3,
    });
    const fail = { ...failure, sendId: sendId! };

    expect((await repo.recordAttempt(fail)).outcome).toBe('retry');
    expect((await repo.recordAttempt(fail)).outcome).toBe('retry');
    expect((await repo.recordAttempt(fail)).outcome).toBe('dead_lettered');

    const dl = await prisma.send.findUniqueOrThrow({ where: { id: sendId! } });
    expect(dl.status).toBe('dead_lettered');
    expect(dl.attempts).toBe(3);
    expect(await prisma.attempt.count({ where: { sendId: sendId! } })).toBe(3);

    // A retryable attempt schedules the next one; the final (giving-up) attempt does not.
    const attempts = await prisma.attempt.findMany({
      where: { sendId: sendId! },
      orderBy: { attemptNo: 'asc' },
    });
    expect(attempts[0]?.nextRetryAt).not.toBeNull();
    expect(attempts[2]?.nextRetryAt).toBeNull();

    const okEvent = await makeEvent();
    const s2 = await repo.ensureSend({ ...base, eventId: okEvent, dedupeKey: `o_${okEvent}` });
    const res = await repo.recordAttempt({
      ...failure,
      sendId: s2.sendId!,
      ok: true,
      statusCode: 202,
      providerId: 'prov_123',
      error: null,
    });
    expect(res.outcome).toBe('sent');
    const sent = await prisma.send.findUniqueOrThrow({ where: { id: s2.sendId! } });
    expect(sent.status).toBe('sent');
    expect(sent.deliveredAt).not.toBeNull();

    // The provider receipt is captured on the attempt — this is the proof of delivery.
    const okAttempt = await prisma.attempt.findFirstOrThrow({ where: { sendId: s2.sendId! } });
    expect(okAttempt.providerId).toBe('prov_123');
  });

  it('dead-letters immediately on a non-retryable provider fault, without burning the budget', async () => {
    const eventId = await makeEvent();
    const { sendId } = await repo.ensureSend({
      ...base,
      eventId,
      dedupeKey: `nr_${eventId}`,
      maxAttempts: 5,
    });

    const res = await repo.recordAttempt({
      ...failure,
      sendId: sendId!,
      statusCode: 422,
      error: 'validation_error: invalid recipient',
      retryable: false,
    });

    // Budget was 5 and only one attempt was made — retrying a permanent fault is pointless.
    expect(res.outcome).toBe('dead_lettered');
    const send = await prisma.send.findUniqueOrThrow({ where: { id: sendId! } });
    expect(send.status).toBe('dead_lettered');
    expect(send.attempts).toBe(1);
  });

  it('replay is idempotent under a double-click (one reset only)', async () => {
    const eventId = await makeEvent();
    const { sendId } = await repo.ensureSend({
      ...base,
      eventId,
      dedupeKey: `rp_${eventId}`,
      maxAttempts: 1, // → dead_lettered on the first failure
    });
    await repo.recordAttempt({ ...failure, sendId: sendId! });
    expect((await prisma.send.findUniqueOrThrow({ where: { id: sendId! } })).status).toBe(
      'dead_lettered',
    );

    const [c1, c2] = await Promise.all([
      repo.claimForReplay(sendId!, 5),
      repo.claimForReplay(sendId!, 5),
    ]);
    expect([c1, c2].filter((c) => c.replayed)).toHaveLength(1);

    const send = await prisma.send.findUniqueOrThrow({ where: { id: sendId! } });
    expect(send.status).toBe('pending');
    // Exactly ONE extension — a double-click must not hand out two budgets.
    expect(send.attemptBudget).toBe(6);
  });

  /**
   * Regression: replay used to reset only `status`, leaving `attempts` at the budget. The
   * next failure computed `attemptNo < attemptBudget` as false and dead-lettered instantly,
   * so a replayed send got zero real retries.
   */
  it('a replayed send gets a real retry budget instead of dead-lettering at once', async () => {
    const eventId = await makeEvent();
    const { sendId } = await repo.ensureSend({
      ...base,
      eventId,
      dedupeKey: `budget_${eventId}`,
      maxAttempts: 2,
    });
    await repo.recordAttempt({ ...failure, sendId: sendId! }); // retry
    await repo.recordAttempt({ ...failure, sendId: sendId! }); // dead_lettered
    expect((await prisma.send.findUniqueOrThrow({ where: { id: sendId! } })).attempts).toBe(2);

    await repo.claimForReplay(sendId!, 2);

    // First post-replay failure must RETRY, not dead-letter.
    expect((await repo.recordAttempt({ ...failure, sendId: sendId! })).outcome).toBe('retry');
    // Then the extended budget (4) is exhausted.
    expect((await repo.recordAttempt({ ...failure, sendId: sendId! })).outcome).toBe(
      'dead_lettered',
    );

    // History is preserved and attemptNo stayed monotonic across the replay.
    const attempts = await prisma.attempt.findMany({
      where: { sendId: sendId! },
      orderBy: { attemptNo: 'asc' },
    });
    expect(attempts.map((a) => a.attemptNo)).toEqual([1, 2, 3, 4]);
  });

  it('replaying a send that is not dead-lettered is a no-op', async () => {
    const eventId = await makeEvent();
    const { sendId } = await repo.ensureSend({ ...base, eventId, dedupeKey: `noop_${eventId}` });
    const before = await prisma.send.findUniqueOrThrow({ where: { id: sendId! } });

    const { replayed } = await repo.claimForReplay(sendId!, 5);

    expect(replayed).toBe(false);
    const after = await prisma.send.findUniqueOrThrow({ where: { id: sendId! } });
    expect(after.status).toBe(before.status);
    expect(after.attemptBudget).toBe(before.attemptBudget);
  });

  it('concurrent ensureSend for the same event yields one send (no deadlock)', async () => {
    const eventId = await makeEvent();
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        repo.ensureSend({ ...base, eventId, dedupeKey: `cc_${eventId}` }),
      ),
    );
    expect(results.filter((r) => r.status === 'created')).toHaveLength(1);
    expect(await prisma.send.count({ where: { causedBy: eventId } })).toBe(1);
  });
});
