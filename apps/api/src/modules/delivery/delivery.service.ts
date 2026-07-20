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
import { ChannelRouter } from './providers/channel.router';
import { SendsMapper } from './sends.mapper';

@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);

  constructor(
    private readonly repo: DeliveryRepository,
    private readonly router: ChannelRouter,
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
    // Channel and recipient are declared by the payload; everything below is channel-agnostic.
    const channel = this.router.resolveChannel(payload);
    const to = this.router.resolveRecipient(payload, channel, event.source);
    const dedupeKey = dedupeKeyFor(to, channel, payload);

    const ensured = await this.repo.ensureSend({
      eventId: event.id,
      source: event.source,
      to,
      channel,
      payload,
      dedupeKey,
      dedupeWindowMs: this.config.deliveryDedupWindowMs,
      maxAttempts: this.config.deliveryMaxAttempts,
    });

    // Collapsed into an earlier send, or already in a terminal state — nothing to deliver.
    if (!ensured.sendId || ensured.status === 'deduped' || ensured.status === 'already_terminal') {
      this.stream.publish({ kind: 'event.updated', eventId: event.id });
      return;
    }

    const started = Date.now();
    const result = await this.router.send(channel, { to, type: event.type, payload });
    const durationMs = Date.now() - started;

    const { outcome, causedBy, attemptNo } = await this.repo.recordAttempt({
      sendId: ensured.sendId,
      ok: result.ok,
      statusCode: result.statusCode,
      providerId: result.providerId,
      error: result.error,
      durationMs,
      retryable: result.retryable,
      backoffMs: this.config.deliveryBackoffMs,
      backoffCapMs: this.config.deliveryBackoffCapMs,
    });

    this.stream.publish({ kind: 'send.updated', sendId: ensured.sendId, causedBy });

    if (outcome === 'dead_lettered') {
      this.logger.warn(
        `Send ${ensured.sendId} dead-lettered after attempt ${attemptNo}: ${result.error ?? 'unknown'}`,
      );
      // Resolved (terminally) as far as the queue is concerned — the DLQ owns it now.
      // Returning instead of throwing keeps the job out of BullMQ's failed set, so the
      // DB remains the single source of truth for what is dead-lettered.
      return;
    }

    if (outcome === 'retry') {
      // Throw → BullMQ re-delivers after the jittered backoff; the same send is reused.
      throw new Error(
        `Delivery attempt ${attemptNo} failed for send ${ensured.sendId}: ${result.error ?? 'unknown'}`,
      );
    }
  }

  /**
   * Idempotent replay of a dead-lettered send (double-click safe). The send's attempt
   * budget is extended by a full `DELIVERY_MAX_ATTEMPTS`, so the replay gets a real retry
   * budget rather than dead-lettering again on its first failure.
   */
  async replay(sendId: string): Promise<SendDto> {
    const { replayed, send } = await this.repo.claimForReplay(
      sendId,
      this.config.deliveryMaxAttempts,
    );
    if (replayed) {
      const event = await this.repo.getEvent(send.causedBy);
      await this.queue.add(
        DELIVERY_JOB_NAME,
        {
          eventId: send.causedBy,
          source: event?.source ?? '',
          receivedAt: (event?.receivedAt ?? send.createdAt).toISOString(),
        },
        // Unique per replay round (attempts never reset), so a genuine second replay is
        // not swallowed by BullMQ's jobId dedup while a double-click still is — the send
        // row's FOR UPDATE claim is the real guard.
        { jobId: `replay:${send.id}:${send.attempts}`, removeOnComplete: true, removeOnFail: false },
      );
      this.stream.publish({ kind: 'send.updated', sendId: send.id, causedBy: send.causedBy });
    }
    return SendsMapper.toDto(send);
  }
}
