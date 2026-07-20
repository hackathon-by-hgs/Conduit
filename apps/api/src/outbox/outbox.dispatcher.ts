import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { AppConfigService } from '../config/config.service';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { DELIVERY_JOB_NAME, type DeliveryJobData } from '../queue/job.types';
import { OutboxRepository, type ClaimedOutbox } from './outbox.repository';

/**
 * Drains the transactional outbox to BullMQ on a fixed interval. This is also the crash
 * recovery mechanism: on boot (and every tick) it re-drains any `pending` rows a previous
 * process left behind, so no persisted-but-unenqueued event is ever lost.
 */
@Injectable()
export class OutboxDispatcher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxDispatcher.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly repo: OutboxRepository,
    private readonly config: AppConfigService,
    @InjectQueue(QUEUE_NAMES.delivery) private readonly deliveryQueue: Queue<DeliveryJobData>,
  ) {}

  async onModuleInit(): Promise<void> {
    const pending = await this.repo.countPending();
    if (pending > 0) {
      this.logger.log(`Recovery: ${pending} pending outbox job(s) queued for dispatch.`);
    }
    this.timer = setInterval(() => void this.dispatch(), this.config.outboxDispatchIntervalMs);
    // Don't keep the event loop alive solely for this ticker.
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Drain the outbox in batches until empty. Non-reentrant (skips if a run is in flight). */
  async dispatch(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      let total = 0;
      for (;;) {
        const n = await this.repo.drainBatch(this.config.outboxBatchSize, (row) =>
          this.enqueue(row),
        );
        total += n;
        if (n < this.config.outboxBatchSize) break;
      }
      if (total > 0) this.logger.debug(`Dispatched ${total} outbox job(s).`);
    } catch (error) {
      this.logger.error(
        'Outbox dispatch failed; rows remain pending and will retry next tick.',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.running = false;
    }
  }

  private async enqueue(row: ClaimedOutbox): Promise<void> {
    await this.deliveryQueue.add(DELIVERY_JOB_NAME, row.payload as DeliveryJobData, {
      // Outbox id as jobId → BullMQ dedups, so a re-dispatch after a crash never double-sends.
      jobId: row.id,
      removeOnComplete: true,
      removeOnFail: false,
    });
  }
}
