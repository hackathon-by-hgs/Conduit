import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import type { SendDto } from '@conduit/contracts';
import { dedupeKeyFor } from '../../common/crypto/hash';
import { AppConfigService } from '../../config/config.service';
import { QUEUE_NAMES } from '../../queue/queue.constants';
import { DELIVERY_JOB_NAME, type DeliveryJobData } from '../../queue/job.types';
import { StreamService } from '../stream/stream.service';
import { DeliveryRepository } from './delivery.repository';
import { ResendProvider } from './email/resend.provider';
import { SendsMapper } from './sends.mapper';

const CHANNEL = 'email';

@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);

  constructor(
    private readonly repo: DeliveryRepository,
    private readonly provider: ResendProvider,
    private readonly stream: StreamService,
    private readonly config: AppConfigService,
    @InjectQueue(QUEUE_NAMES.delivery) private readonly queue: Queue<DeliveryJobData>,
  ) {}

  /**
   * Worker entrypoint for a delivery job. Idempotent (safe to re-run on retry/recovery):
   * the send is created once, attempts accumulate, and a transient failure throws to let
   * BullMQ retry with backoff. Deadlock-free — all locking is per-row / per-source.
   */
  async processDelivery(job: DeliveryJobData): Promise<void> {
    const event = await this.repo.getEvent(job.eventId);
    if (!event) {
      this.logger.warn(`Delivery job for missing event ${job.eventId}; dropping.`);
      return;
    }

    const payload = (event.payload ?? {}) as Record<string, unknown>;
    const to = typeof payload.to === 'string' ? payload.to : `${event.source}@webhooks.conduit.dev`;
    const dedupeKey = dedupeKeyFor(to, CHANNEL, payload);

    const ensured = await this.repo.ensureSend({
      eventId: event.id,
      source: event.source,
      to,
      channel: CHANNEL,
      payload,
      dedupeKey,
      dedupeWindowMs: this.config.deliveryDedupWindowMs,
    });

    // Collapsed into an earlier send, or already in a terminal state — nothing to deliver.
    if (!ensured.sendId || ensured.status === 'deduped' || ensured.status === 'already_terminal') {
      this.stream.publish({ kind: 'event.updated', eventId: event.id });
      return;
    }

    const started = Date.now();
    const result = await this.provider.send({ to, subject: event.type, html: `<p>${event.type}</p>` });
    const durationMs = Date.now() - started;

    const { outcome, causedBy } = await this.repo.recordAttempt({
      sendId: ensured.sendId,
      ok: result.ok,
      statusCode: result.statusCode,
      error: result.error,
      durationMs,
      maxAttempts: this.config.deliveryMaxAttempts,
      backoffMs: this.config.deliveryBackoffMs,
    });

    this.stream.publish({ kind: 'send.updated', sendId: ensured.sendId, causedBy });

    if (outcome === 'retry') {
      // Throw → BullMQ re-delivers with backoff; the same send is reused next run.
      throw new Error(`Delivery failed for send ${ensured.sendId}; will retry.`);
    }
  }

  /** Idempotent replay of a dead-lettered send (double-click safe). */
  async replay(sendId: string): Promise<SendDto> {
    const { replayed, send } = await this.repo.claimForReplay(sendId);
    if (replayed) {
      const event = await this.repo.getEvent(send.causedBy);
      await this.queue.add(
        DELIVERY_JOB_NAME,
        {
          eventId: send.causedBy,
          source: event?.source ?? '',
          receivedAt: (event?.receivedAt ?? send.createdAt).toISOString(),
        },
        // Deterministic-ish jobId per replay attempt; the send row itself is the dedup guard.
        { jobId: `replay:${send.id}:${send.attempts}`, removeOnComplete: true, removeOnFail: false },
      );
    }
    return SendsMapper.toDto(send);
  }
}
