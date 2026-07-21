import 'reflect-metadata';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '../src/generated/prisma/client';
import { DeliveryRepository } from '../src/modules/delivery/delivery.repository';
import { ReconciliationRepository } from '../src/modules/reconciliation/reconciliation.repository';
import type { PrismaService } from '../src/common/prisma/prisma.service';

/**
 * Explicit sends — the `POST /sends` / `conduit.send()` path, where the CALLER decides the
 * recipient and content instead of the worker inferring them from the event.
 *
 * The guarantee under test is exactly-once: the SDK promises that a retried send returns the
 * original rather than delivering twice, and that promise is enforced by a unique index
 * rather than a check-then-insert race.
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const repo = new DeliveryRepository(prisma as unknown as PrismaService);
const reconciliation = new ReconciliationRepository(prisma as unknown as PrismaService);

const SOURCE = `itest_explicit_${process.pid}_${Date.now()}`;
let seq = 0;

async function makeEvent(): Promise<string> {
  const event = await prisma.webhookEvent.create({
    data: {
      source: SOURCE,
      type: 'invoice.paid',
      idempotencyKey: `${SOURCE}_${seq++}`,
      payload: { to: 'payload-derived@example.com' },
      status: 'received',
    },
  });
  return event.id;
}

const base = {
  channel: 'email',
  to: 'chosen-by-caller@example.com',
  payload: { template: 'receipt' } as Record<string, unknown>,
  dedupeKey: 'dk',
  maxAttempts: 5,
};

afterAll(async () => {
  await prisma.webhookEvent.deleteMany({ where: { source: SOURCE } }); // cascades sends
  await prisma.$disconnect();
});

describe('Explicit sends (POST /sends)', () => {
  it('creates the send and its outbox row in one transaction', async () => {
    const eventId = await makeEvent();

    const { send, created } = await repo.createExplicitSend({
      ...base,
      eventId,
      idempotencyKey: `k_${eventId}`,
    });

    expect(created).toBe(true);
    expect(send.status).toBe('pending');
    // The caller's recipient wins — NOT the address sitting in the event payload.
    expect(send.to).toBe('chosen-by-caller@example.com');
    expect(send.attemptBudget).toBe(5);

    // The delivery hand-off is queued atomically, and targets THIS send.
    const outbox = await prisma.outboxJob.findMany({ where: { eventId } });
    expect(outbox).toHaveLength(1);
    expect((outbox[0]?.payload as { sendId?: string }).sendId).toBe(send.id);

    // Creating a send is the decision about the event, so the event is now processed —
    // which is what brings it under the reconciler's watch.
    const event = await prisma.webhookEvent.findUniqueOrThrow({ where: { id: eventId } });
    expect(event.status).toBe('processed');
    expect(event.processedAt).not.toBeNull();
  });

  /**
   * Regression: with AUTO_DELIVER off, nothing marked the event processed, so a perfectly
   * healthy explicit send tripped `orphan_send` — "a terminal send whose event is not
   * processed". Every SDK send produced a false gap.
   */
  it('does not leave a healthy send looking like an orphan', async () => {
    const eventId = await makeEvent();
    const { send } = await repo.createExplicitSend({
      ...base,
      eventId,
      idempotencyKey: `k_orphan_${eventId}`,
    });
    await prisma.send.update({ where: { id: send.id }, data: { status: 'sent' } });

    const orphans = await reconciliation.orphanSends();
    expect(orphans.map((o) => o.id)).not.toContain(send.id);
  });

  it('returns the ORIGINAL send when the same key is reused', async () => {
    const eventId = await makeEvent();
    const key = `k_repeat_${eventId}`;

    const first = await repo.createExplicitSend({ ...base, eventId, idempotencyKey: key });
    const second = await repo.createExplicitSend({
      ...base,
      eventId,
      idempotencyKey: key,
      to: 'someone-else@example.com', // ignored: the key already identifies a send
    });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.send.id).toBe(first.send.id);
    expect(second.send.to).toBe('chosen-by-caller@example.com');

    // One send, and crucially one outbox row — a retry must not queue a second delivery.
    expect(await prisma.send.count({ where: { causedBy: eventId } })).toBe(1);
    expect(await prisma.outboxJob.count({ where: { eventId } })).toBe(1);
  });

  it('collapses concurrent identical calls to exactly one send', async () => {
    const eventId = await makeEvent();
    const key = `k_race_${eventId}`;

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        repo.createExplicitSend({ ...base, eventId, idempotencyKey: key }),
      ),
    );

    expect(results.filter((r) => r.created)).toHaveLength(1);
    expect(new Set(results.map((r) => r.send.id)).size).toBe(1);
    expect(await prisma.send.count({ where: { causedBy: eventId } })).toBe(1);
  });

  it('rejects a send whose causing event does not exist', async () => {
    await expect(
      repo.createExplicitSend({
        ...base,
        eventId: '00000000-0000-0000-0000-000000000000',
        idempotencyKey: `k_missing_${Date.now()}`,
      }),
    ).rejects.toThrow(/not found/i);
  });

  it('lets one event carry several sends on different channels', async () => {
    const eventId = await makeEvent();

    await repo.createExplicitSend({
      ...base,
      eventId,
      idempotencyKey: `k_email_${eventId}`,
    });
    await repo.createExplicitSend({
      ...base,
      eventId,
      channel: 'sms',
      to: '+15551234567',
      idempotencyKey: `k_sms_${eventId}`,
    });

    expect(await prisma.send.count({ where: { causedBy: eventId } })).toBe(2);
  });

  /**
   * The auto-pilot worker must not mistake an explicit send for its own work, or it would
   * skip delivering and the caller's message would never go out.
   */
  it('is invisible to the auto-pilot path, which only owns its own sends', async () => {
    const eventId = await makeEvent();
    await repo.createExplicitSend({ ...base, eventId, idempotencyKey: `k_auto_${eventId}` });

    const ensured = await repo.ensureSend({
      eventId,
      source: SOURCE,
      to: 'payload-derived@example.com',
      channel: 'email',
      payload: {},
      dedupeKey: `auto_${eventId}`,
      dedupeWindowMs: 0,
      maxAttempts: 5,
    });

    expect(ensured.status).toBe('created');
    const sends = await prisma.send.findMany({ where: { causedBy: eventId } });
    expect(sends).toHaveLength(2);
    expect(sends.filter((s) => s.idempotencyKey === null)).toHaveLength(1);
  });
});

describe('duplicate_send detection', () => {
  it('ignores one event delivering on two different channels', async () => {
    const eventId = await makeEvent();
    for (const [channel, to] of [
      ['email', 'a@example.com'],
      ['sms', '+15551234567'],
    ] as const) {
      await prisma.send.create({
        data: { causedBy: eventId, channel, to, payload: {}, status: 'sent' },
      });
    }

    expect(await reconciliation.eventsWithDuplicateDeliveredSends()).not.toContain(eventId);
  });

  it('still catches the same message delivered twice', async () => {
    const eventId = await makeEvent();
    for (let i = 0; i < 2; i++) {
      await prisma.send.create({
        data: {
          causedBy: eventId,
          channel: 'email',
          to: 'same@example.com',
          payload: {},
          status: 'sent',
        },
      });
    }

    expect(await reconciliation.eventsWithDuplicateDeliveredSends()).toContain(eventId);
  });
});
