import { Injectable } from '@nestjs/common';
import type { GapType } from '@conduit/contracts';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { Prisma, ReconcileGap } from '../../generated/prisma/client';

export type GapRow = ReconcileGap;

/** A gap the reconciler wants to persist (plain shape — no Prisma types leak to the service). */
export interface NewGap {
  type: GapType;
  detail: string;
  eventId: string | null;
  sendId: string | null;
}

/** Send statuses that count as "terminal" for the invariant (delivered or gave up). */
const TERMINAL_SEND_STATUSES = ['sent', 'dead_lettered'];

@Injectable()
export class ReconciliationRepository {
  constructor(private readonly prisma: PrismaService) {}

  findGaps(range: { from?: string; to?: string }): Promise<GapRow[]> {
    const { from, to } = range;
    const where: Prisma.ReconcileGapWhereInput = {
      ...(from || to
        ? {
            detectedAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    };
    return this.prisma.reconcileGap.findMany({ where, orderBy: { detectedAt: 'desc' } });
  }

  countOpenGaps(): Promise<number> {
    return this.prisma.reconcileGap.count({ where: { resolvedAt: null } });
  }

  openGaps(): Promise<GapRow[]> {
    return this.prisma.reconcileGap.findMany({ where: { resolvedAt: null } });
  }

  /** Invariant check: processed events with no send in a terminal state → `no_send`. */
  async processedEventsWithoutTerminalSend(): Promise<string[]> {
    const rows = await this.prisma.webhookEvent.findMany({
      where: {
        status: 'processed',
        sends: { none: { status: { in: TERMINAL_SEND_STATUSES } } },
      },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  /** Events with more than one delivered send → `duplicate_send`. */
  async eventsWithDuplicateDeliveredSends(): Promise<string[]> {
    const groups = await this.prisma.send.groupBy({
      by: ['causedBy'],
      where: { status: 'sent' },
      _count: { causedBy: true },
      having: { causedBy: { _count: { gt: 1 } } },
    });
    return groups.map((g) => g.causedBy);
  }

  /** Sends stuck in a non-terminal state past a threshold → `stuck`. */
  stuckSends(olderThan: Date): Promise<{ id: string; causedBy: string }[]> {
    return this.prisma.send.findMany({
      where: { status: { in: ['pending', 'failed'] }, createdAt: { lt: olderThan } },
      select: { id: true, causedBy: true },
    });
  }

  /**
   * Insert gaps, deduped at the DB by the partial unique index on OPEN gaps
   * (`reconcile_gaps_open_unique`, NULLS NOT DISTINCT). Safe under concurrent reconciler
   * runs (e.g. multiple API instances) — a conflicting open gap is silently skipped.
   */
  async createGaps(gaps: NewGap[]): Promise<number> {
    let created = 0;
    for (const g of gaps) {
      const inserted = await this.prisma.$executeRaw`
        INSERT INTO "reconcile_gaps" ("id", "type", "eventId", "sendId", "detail", "detectedAt")
        VALUES (gen_random_uuid()::text, ${g.type}, ${g.eventId}, ${g.sendId}, ${g.detail}, now())
        ON CONFLICT ("type", "eventId", "sendId") WHERE "resolvedAt" IS NULL DO NOTHING
      `;
      created += Number(inserted);
    }
    return created;
  }
}
