import 'reflect-metadata';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '../src/generated/prisma/client';
import { ReconciliationRepository } from '../src/modules/reconciliation/reconciliation.repository';
import type { PrismaService } from '../src/common/prisma/prisma.service';

/**
 * Open gaps are deduped by a partial UNIQUE index (WHERE resolvedAt IS NULL, NULLS NOT
 * DISTINCT), so even concurrent reconciler runs across instances can't create duplicate
 * open gaps — including no_send gaps whose sendId is NULL.
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const repo = new ReconciliationRepository(prisma as unknown as PrismaService);
const SOURCE = `itest_gapu_${process.pid}_${Date.now()}`;

afterAll(async () => {
  const events = await prisma.webhookEvent.findMany({ where: { source: SOURCE }, select: { id: true } });
  await prisma.reconcileGap.deleteMany({ where: { eventId: { in: events.map((e) => e.id) } } });
  await prisma.webhookEvent.deleteMany({ where: { source: SOURCE } });
  await prisma.$disconnect();
});

describe('Open-gap DB uniqueness', () => {
  it('collapses concurrent identical open gaps to one row (NULL sendId safe)', async () => {
    const event = await prisma.webhookEvent.create({
      data: { source: SOURCE, type: 't', idempotencyKey: `${SOURCE}_1`, payload: {}, status: 'processed' },
    });
    const gap = { type: 'no_send' as const, detail: 'x', eventId: event.id, sendId: null };

    const results = await Promise.all(Array.from({ length: 5 }, () => repo.createGaps([gap])));

    const totalInserted = results.reduce((a, b) => a + b, 0);
    const inDb = await prisma.reconcileGap.count({
      where: { eventId: event.id, type: 'no_send', resolvedAt: null },
    });
    expect(inDb).toBe(1);
    expect(totalInserted).toBe(1);
  });
});
