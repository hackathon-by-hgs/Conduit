import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import {
  GAP_TYPE,
  type GapDto,
  type GapSummary,
  type GapType,
  type ReconcileQuery,
  type ReconcileReportDto,
} from '@conduit/contracts';
import { AppConfigService } from '../../config/config.service';
import { StreamService } from '../stream/stream.service';
import { type NewGap, ReconciliationRepository } from './reconciliation.repository';
import { GapsMapper } from './reconciliation.mapper';

/** Identity of a gap: the same violation must always produce the same key. */
function gapKey(type: GapType, eventId: string | null, sendId: string | null): string {
  return `${type}:${eventId ?? ''}:${sendId ?? ''}`;
}

export interface ReconcilerRunResult {
  /** Newly-detected gaps persisted this pass. */
  created: number;
  /** Previously-open gaps whose violation no longer holds, closed this pass. */
  resolved: number;
  report: ReconcileReportDto;
}

@Injectable()
export class ReconciliationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReconciliationService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  /** When the last pass COMPLETED. Null until the reconciler has run at least once. */
  private lastRunAt: Date | null = null;

  constructor(
    private readonly repo: ReconciliationRepository,
    private readonly config: AppConfigService,
    private readonly stream: StreamService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.tick(), this.config.reconcileIntervalMs);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Scheduled reconciler pass; non-reentrant. */
  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const { created, resolved } = await this.runReconciler();
      if (created > 0 || resolved > 0) {
        this.logger.log(`Reconciler: ${created} new gap(s), ${resolved} resolved.`);
      }
    } catch (error) {
      this.logger.error('Reconciler pass failed', error instanceof Error ? error.stack : undefined);
    } finally {
      this.running = false;
    }
  }

  async getReport(query: ReconcileQuery): Promise<ReconcileReportDto> {
    const rows = await this.repo.findGaps(query);
    const gaps = rows.map(GapsMapper.toDto);

    return {
      gaps,
      summary: summarize(gaps),
      lastRunAt: this.lastRunAt?.toISOString() ?? null,
      // The invariant holds when nothing in this window is still unaccounted for.
      // Resolved gaps are history, not outstanding violations.
      invariantHolds: gaps.every((g) => g.resolvedAt !== null),
    };
  }

  /**
   * One reconciliation pass. Recomputes the CURRENT violation set from the event/send log,
   * then reconciles it against the stored open gaps in both directions:
   *
   * - a violation with no open gap  → emit a gap
   * - an open gap with no violation → resolve it
   *
   * This makes the reconciler level-triggered rather than edge-triggered: its output depends
   * only on the present state of the log, so a missed run, a restart, or a duplicate run all
   * converge on the same answer. Emission is additionally deduped in the DB by the partial
   * unique index on open gaps, so concurrent API instances are safe.
   */
  async runReconciler(): Promise<ReconcilerRunResult> {
    const now = Date.now();
    const stuckThreshold = new Date(now - this.config.reconcileStuckAfterMs);
    // In-flight deliveries are not gaps; only count an event once its grace period elapsed.
    const noSendThreshold = new Date(now - this.config.reconcileNoSendGraceMs);

    const [noSend, duplicates, stuck, orphans, open] = await Promise.all([
      this.repo.processedEventsWithoutTerminalSend(noSendThreshold),
      this.repo.eventsWithDuplicateDeliveredSends(),
      this.repo.stuckSends(stuckThreshold),
      this.repo.orphanSends(),
      this.repo.openGaps(),
    ]);

    // 1. The current violation set, keyed by identity.
    const violations = new Map<string, NewGap>();
    const add = (type: GapType, detail: string, eventId: string | null, sendId: string | null) => {
      violations.set(gapKey(type, eventId, sendId), { type, detail, eventId, sendId });
    };

    for (const id of noSend) {
      add('no_send', `Processed event ${id} has no send in a terminal state.`, id, null);
    }
    for (const id of duplicates) {
      add('duplicate_send', `Event ${id} has more than one delivered send.`, id, null);
    }
    for (const s of stuck) {
      add('stuck', `Send ${s.id} is stuck in a non-terminal state.`, s.causedBy, s.id);
    }
    for (const s of orphans) {
      add(
        'orphan_send',
        `Send ${s.id} is ${s.status} but its event is not marked processed.`,
        s.causedBy,
        s.id,
      );
    }

    // 2. Diff against what is already open, in both directions.
    const openKeys = new Set(open.map((g) => gapKey(g.type as GapType, g.eventId, g.sendId)));
    const toCreate = [...violations.entries()]
      .filter(([key]) => !openKeys.has(key))
      .map(([, gap]) => gap);
    const toResolve = open
      .filter((g) => !violations.has(gapKey(g.type as GapType, g.eventId, g.sendId)))
      .map((g) => g.id);

    const [created, resolved] = await Promise.all([
      this.repo.createGaps(toCreate),
      this.repo.resolveGaps(toResolve),
    ]);

    this.lastRunAt = new Date();

    // Nudge the dashboard only when something actually changed.
    if (created > 0 || resolved > 0) {
      this.stream.publish({ kind: 'gap.detected', gapId: null });
    }

    return { created, resolved, report: await this.getReport({}) };
  }
}

/** Per-type counts plus the open/resolved split, over the gaps in the report. */
function summarize(gaps: GapDto[]): GapSummary {
  const byType = Object.fromEntries(GAP_TYPE.map((t) => [t, 0])) as Record<GapType, number>;
  let open = 0;
  for (const gap of gaps) {
    byType[gap.type] += 1;
    if (gap.resolvedAt === null) open += 1;
  }
  return { ...byType, total: gaps.length, open, resolved: gaps.length - open };
}
