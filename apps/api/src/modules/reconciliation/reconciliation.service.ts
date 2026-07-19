import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import {
  GAP_TYPE,
  type GapType,
  type ReconcileQuery,
  type ReconcileReportDto,
} from '@conduit/contracts';
import { AppConfigService } from '../../config/config.service';
import { type NewGap, ReconciliationRepository } from './reconciliation.repository';
import { GapsMapper } from './reconciliation.mapper';

/** A send is considered "stuck" after this long in a non-terminal state. */
const STUCK_AFTER_MS = 5 * 60_000;

function gapKey(type: GapType, eventId: string | null, sendId: string | null): string {
  return `${type}:${eventId ?? ''}:${sendId ?? ''}`;
}

@Injectable()
export class ReconciliationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReconciliationService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly repo: ReconciliationRepository,
    private readonly config: AppConfigService,
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
      const { created } = await this.runReconciler();
      if (created > 0) this.logger.log(`Reconciler emitted ${created} new gap(s).`);
    } catch (error) {
      this.logger.error(
        'Reconciler pass failed',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.running = false;
    }
  }

  async getReport(query: ReconcileQuery): Promise<ReconcileReportDto> {
    const rows = await this.repo.findGaps(query);
    const gaps = rows.map(GapsMapper.toDto);

    const summary = GAP_TYPE.reduce(
      (acc, type) => ({ ...acc, [type]: gaps.filter((g) => g.type === type).length }),
      {} as Record<GapType, number>,
    );

    return {
      gaps,
      summary: { ...summary, total: gaps.length },
      lastRunAt: new Date().toISOString(),
      invariantHolds: gaps.every((g) => g.resolvedAt !== null),
    };
  }

  /**
   * Checks the invariant — every `processed` event has ≥1 send in a terminal state — and
   * persists any newly-detected gaps. Idempotent: an open gap for the same (type, event,
   * send) is not re-emitted on subsequent runs.
   *
   * TODO(BE2): wire a ~30s schedule (e.g. @nestjs/schedule @Interval) to call this; add
   * `orphan_send` detection (a terminal send whose event isn't `processed`).
   */
  async runReconciler(): Promise<{ created: number; report: ReconcileReportDto }> {
    const stuckThreshold = new Date(Date.now() - STUCK_AFTER_MS);

    const [noSend, duplicates, stuck, open] = await Promise.all([
      this.repo.processedEventsWithoutTerminalSend(),
      this.repo.eventsWithDuplicateDeliveredSends(),
      this.repo.stuckSends(stuckThreshold),
      this.repo.openGaps(),
    ]);

    const seen = new Set(open.map((g) => gapKey(g.type as GapType, g.eventId, g.sendId)));
    const toCreate: NewGap[] = [];
    const enqueue = (type: GapType, detail: string, eventId: string | null, sendId: string | null) => {
      const key = gapKey(type, eventId, sendId);
      if (seen.has(key)) return;
      seen.add(key);
      toCreate.push({ type, detail, eventId, sendId });
    };

    for (const id of noSend) {
      enqueue('no_send', `Processed event ${id} has no send in a terminal state.`, id, null);
    }
    for (const id of duplicates) {
      enqueue('duplicate_send', `Event ${id} has more than one delivered send.`, id, null);
    }
    for (const s of stuck) {
      enqueue('stuck', `Send ${s.id} is stuck in a non-terminal state.`, s.causedBy, s.id);
    }

    const created = await this.repo.createGaps(toCreate);
    return { created, report: await this.getReport({}) };
  }
}
