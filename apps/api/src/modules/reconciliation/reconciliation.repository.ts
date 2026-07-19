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

  async createGaps(gaps: NewGap[]): Promise<number> {
    if (gaps.length === 0) return 0;
    const res = await this.prisma.reconcileGap.createMany({
      data: gaps.map((g) => ({
        type: g.type,
        detail: g.detail,
        eventId: g.eventId,
        sendId: g.sendId,
      })),
    });
    return res.count;
  }
}
