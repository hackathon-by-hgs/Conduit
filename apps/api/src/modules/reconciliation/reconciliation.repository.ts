import { Injectable } from '@nestjs/common';
import type { GapFilter, GapType } from '@conduit/contracts';
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

  findGaps(range: { from?: string; to?: string; status?: GapFilter }): Promise<GapRow[]> {
    const { from, to, status } = range;
    const where: Prisma.ReconcileGapWhereInput = {
      ...(from || to
        ? {
            detectedAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
      ...(status === 'open' ? { resolvedAt: null } : {}),
      ...(status === 'resolved' ? { resolvedAt: { not: null } } : {}),
    };
    return this.prisma.reconcileGap.findMany({ where, orderBy: { detectedAt: 'desc' } });
  }

  countOpenGaps(): Promise<number> {
    return this.prisma.reconcileGap.count({ where: { resolvedAt: null } });
  }

  openGaps(): Promise<GapRow[]> {
    return this.prisma.reconcileGap.findMany({ where: { resolvedAt: null } });
  }

  /**
   * Invariant check: processed events with no send in a terminal state → `no_send`.
   *
   * An event is marked `processed` at the moment its send row is created, so a delivery
   * that is merely still in flight would otherwise trip this check and produce a gap that
   * resolves itself seconds later. `processedBefore` is a grace period that excludes those:
   * a gap should mean "this is genuinely unaccounted for", not "this is still working".
   *
   * A null `processedAt` on a `processed` event is anomalous rather than in-flight (the
   * worker always stamps it), so it is reported instead of excused.
   */
  async processedEventsWithoutTerminalSend(processedBefore: Date): Promise<string[]> {
    const rows = await this.prisma.webhookEvent.findMany({
      where: {
        status: 'processed',
        OR: [{ processedAt: { lt: processedBefore } }, { processedAt: null }],
        // Deliberately collapsed into an earlier identical send — accounted for, not missing.
        collapsedInto: null,
        sends: { none: { status: { in: TERMINAL_SEND_STATUSES } } },
      },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  /**
   * The SAME message delivered more than once → `duplicate_send`.
   *
   * Grouped by (causedBy, channel, to), not by event alone: one event legitimately producing
   * both a receipt email and a confirmation SMS is two different messages, not a duplicate.
   * Only the same content going to the same recipient on the same channel twice is a fault.
   */
  async eventsWithDuplicateDeliveredSends(): Promise<string[]> {
    const groups = await this.prisma.send.groupBy({
      by: ['causedBy', 'channel', 'to'],
      where: { status: 'sent' },
      _count: { causedBy: true },
      // Counts rows within each (causedBy, channel, to) group.
      having: { causedBy: { _count: { gt: 1 } } },
    });
    // Gaps are keyed on the event, so collapse repeats across channels for the same event.
    return [...new Set(groups.map((g) => g.causedBy))];
  }

  /** Sends stuck in a non-terminal state past a threshold → `stuck`. */
  stuckSends(olderThan: Date): Promise<{ id: string; causedBy: string }[]> {
    return this.prisma.send.findMany({
      where: { status: { in: ['pending', 'failed'] }, createdAt: { lt: olderThan } },
      select: { id: true, causedBy: true },
    });
  }

  /**
   * The mirror of `no_send`: a send reached a terminal state, but the event that supposedly
   * caused it was never marked `processed` → `orphan_send`. That means an outbound effect
   * exists without a settled inbound cause — the audit trail doesn't add up, which is
   * exactly what the reconciler exists to surface.
   *
   * (A send whose event row is gone cannot occur: `Send.causedBy` cascades on delete.)
   */
  orphanSends(): Promise<{ id: string; causedBy: string; status: string }[]> {
    return this.prisma.send.findMany({
      where: {
        status: { in: TERMINAL_SEND_STATUSES },
        event: { status: { not: 'processed' } },
      },
      select: { id: true, causedBy: true, status: true },
    });
  }

  /**
   * Close the open gaps whose underlying violation no longer holds (e.g. a dead-lettered
   * send was replayed to success). Without this the dashboard would only ever accumulate
   * gaps and could never show the invariant returning to green.
   *
   * Returns the number of gaps closed.
   */
  async resolveGaps(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const { count } = await this.prisma.reconcileGap.updateMany({
      where: { id: { in: ids }, resolvedAt: null },
      data: { resolvedAt: new Date() },
    });
    return count;
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
