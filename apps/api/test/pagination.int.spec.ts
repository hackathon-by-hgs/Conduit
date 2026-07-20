import 'reflect-metadata';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '../src/generated/prisma/client';
import { EventsRepository } from '../src/modules/events/events.repository';
import { EventsService } from '../src/modules/events/events.service';
import type { PrismaService } from '../src/common/prisma/prisma.service';

/**
 * Keyset pagination must be stable even when the sort key (receivedAt) ties. Before the
 * (receivedAt, id) total ordering, an id-cursor over a receivedAt-only sort could skip or
 * repeat rows at page boundaries. This inserts N events sharing one receivedAt and pages
 * through them, asserting each is seen exactly once.
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const service = new EventsService(new EventsRepository(prisma as unknown as PrismaService));

const SOURCE = `itest_page_${process.pid}_${Date.now()}`;
const SHARED_AT = new Date('2026-06-01T00:00:00.000Z');
const N = 7;

beforeAll(async () => {
  for (let i = 0; i < N; i++) {
    await prisma.webhookEvent.create({
      data: {
        source: SOURCE,
        type: 't',
        idempotencyKey: `${SOURCE}_${i}`,
        payload: { i },
        receivedAt: SHARED_AT, // identical timestamps → the tie that broke the old cursor
      },
    });
  }
});

afterAll(async () => {
  await prisma.webhookEvent.deleteMany({ where: { source: SOURCE } });
  await prisma.$disconnect();
});

describe('Keyset pagination stability', () => {
  it('pages through rows that share a receivedAt without skips or duplicates', async () => {
    const seen: string[] = [];
    let cursor: string | undefined;

    for (let guard = 0; guard < 20; guard++) {
      const page = await service.list({ source: SOURCE, limit: 3, cursor });
      seen.push(...page.items.map((e) => e.id));
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }

    expect(seen).toHaveLength(N); // no duplicates
    expect(new Set(seen).size).toBe(N); // no skips (all distinct, all present)
  });
});
