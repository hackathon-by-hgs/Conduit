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
 * - recordAttempt: failures escalate pending → failed → dead_lettered; success → sent.
 * - claimForReplay: a double-click resets a dead-lettered send exactly once (row lock).
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
    const { sendId } = await repo.ensureSend({ ...base, eventId: failEvent, dedupeKey: `f_${failEvent}` });
    const fail = {
      sendId: sendId!,
      ok: false,
      statusCode: 500,
      error: 'boom',
      durationMs: 10,
      maxAttempts: 3,
      backoffMs: 100,
    };
    expect((await repo.recordAttempt(fail)).outcome).toBe('retry');
    expect((await repo.recordAttempt(fail)).outcome).toBe('retry');
    expect((await repo.recordAttempt(fail)).outcome).toBe('dead_lettered');
    const dl = await prisma.send.findUniqueOrThrow({ where: { id: sendId! } });
    expect(dl.status).toBe('dead_lettered');
    expect(dl.attempts).toBe(3);
    expect(await prisma.attempt.count({ where: { sendId: sendId! } })).toBe(3);

    const okEvent = await makeEvent();
    const s2 = await repo.ensureSend({ ...base, eventId: okEvent, dedupeKey: `o_${okEvent}` });
    const res = await repo.recordAttempt({
      sendId: s2.sendId!,
      ok: true,
      statusCode: 202,
      error: null,
      durationMs: 5,
      maxAttempts: 3,
      backoffMs: 100,
    });
    expect(res.outcome).toBe('sent');
    const sent = await prisma.send.findUniqueOrThrow({ where: { id: s2.sendId! } });
    expect(sent.status).toBe('sent');
    expect(sent.deliveredAt).not.toBeNull();
  });

  it('replay is idempotent under a double-click (one reset only)', async () => {
    const eventId = await makeEvent();
    const { sendId } = await repo.ensureSend({ ...base, eventId, dedupeKey: `rp_${eventId}` });
    await repo.recordAttempt({
      sendId: sendId!,
      ok: false,
      statusCode: 500,
      error: 'boom',
      durationMs: 10,
      maxAttempts: 1, // → dead_lettered immediately
      backoffMs: 100,
    });
    expect((await prisma.send.findUniqueOrThrow({ where: { id: sendId! } })).status).toBe('dead_lettered');

    const [c1, c2] = await Promise.all([repo.claimForReplay(sendId!), repo.claimForReplay(sendId!)]);
    expect([c1, c2].filter((c) => c.replayed)).toHaveLength(1);
    expect((await prisma.send.findUniqueOrThrow({ where: { id: sendId! } })).status).toBe('pending');
  });

  it('concurrent ensureSend for the same event yields one send (no deadlock)', async () => {
    const eventId = await makeEvent();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => repo.ensureSend({ ...base, eventId, dedupeKey: `cc_${eventId}` })),
    );
    expect(results.filter((r) => r.status === 'created')).toHaveLength(1);
    expect(await prisma.send.count({ where: { causedBy: eventId } })).toBe(1);
  });
});
