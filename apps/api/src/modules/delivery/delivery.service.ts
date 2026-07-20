import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import type { Channel, CreateSendRequest, SendDto } from '@conduit/contracts';
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
   *
   * Two ways in:
   * - `job.sendId` set → an explicit `POST /sends` (the SDK path). That row already says
   *   who and what, so it is delivered as written.
   * - no `sendId` → auto-pilot: derive a send from the event, if AUTO_DELIVER is on.
   */
  async processDelivery(job: DeliveryJobData): Promise<void> {
    const event = await this.repo.getEvent(job.eventId);
    if (!event) {
      this.logger.warn(`Delivery job for missing event ${job.eventId}; dropping.`);
      return;
    }

    const sendId = job.sendId ?? (await this.resolveAutoSend(job, event.id));
    if (!sendId) return;

    // The SEND ROW is the source of truth for what to deliver — not the event. An explicit
    // send carries the caller's recipient and content, and a replay must reuse exactly what
    // was originally intended rather than re-deriving it from the event payload.
    const send = await this.repo.getSend(sendId);
    if (!send) {
      this.logger.warn(`Delivery job for missing send ${sendId}; dropping.`);
      return;
    }
    if (send.status === 'sent' || send.status === 'dead_lettered') {
      // Already settled (a re-delivered job, or a crash after the attempt was recorded).
      this.stream.publish({ kind: 'event.updated', eventId: event.id });
      return;
    }

    const sendPayload = (send.payload ?? {}) as Record<string, unknown>;
    const started = Date.now();
    const result = await this.router.send(send.channel as Channel, {
      to: send.to,
      type: event.type,
      payload: sendPayload,
    });
    const durationMs = Date.now() - started;

    const { outcome, causedBy, attemptNo } = await this.repo.recordAttempt({
      sendId,
      ok: result.ok,
      statusCode: result.statusCode,
      providerId: result.providerId,
      error: result.error,
      durationMs,
      retryable: result.retryable,
      backoffMs: this.config.deliveryBackoffMs,
      backoffCapMs: this.config.deliveryBackoffCapMs,
    });

    this.stream.publish({ kind: 'send.updated', sendId, causedBy });

    if (outcome === 'dead_lettered') {
      this.logger.warn(
        `Send ${sendId} dead-lettered after attempt ${attemptNo}: ${result.error ?? 'unknown'}`,
      );
      // Resolved (terminally) as far as the queue is concerned — the DLQ owns it now.
      // Returning instead of throwing keeps the job out of BullMQ's failed set, so the
      // DB remains the single source of truth for what is dead-lettered.
      return;
    }

    if (outcome === 'retry') {
      // Throw → BullMQ re-delivers after the jittered backoff; the same send is reused.
      throw new Error(
        `Delivery attempt ${attemptNo} failed for send ${sendId}: ${result.error ?? 'unknown'}`,
      );
    }
  }

  /**
   * Auto-pilot: derive a send from the event itself. Returns the send id to deliver, or
   * null when there is nothing to do.
   *
   * With `AUTO_DELIVER=false` this does nothing at all and the event stays `received` —
   * deliberately. The event is durably stored and waiting on the caller's `conduit.send()`
   * decision, and the reconciler only judges `processed` events, so an undecided event is
   * never mistaken for a lost one.
   */
  private async resolveAutoSend(job: DeliveryJobData, eventId: string): Promise<string | null> {
    if (!this.config.autoDeliver) return null;

    const event = await this.repo.getEvent(eventId);
    if (!event) return null;

    const payload = (event.payload ?? {}) as Record<string, unknown>;
    // Channel and recipient are declared by the payload; everything below is channel-agnostic.
    const channel = this.router.resolveChannel(payload);
    const to = this.router.resolveRecipient(payload, channel, event.source);

    const ensured = await this.repo.ensureSend({
      eventId,
      source: job.source || event.source,
      to,
      channel,
      payload,
      dedupeKey: dedupeKeyFor(to, channel, payload),
      dedupeWindowMs: this.config.deliveryDedupWindowMs,
      maxAttempts: this.config.deliveryMaxAttempts,
    });

    // Collapsed into an earlier send, or already terminal — nothing left to deliver.
    if (!ensured.sendId || ensured.status === 'deduped' || ensured.status === 'already_terminal') {
      this.stream.publish({ kind: 'event.updated', eventId });
      return null;
    }
    return ensured.sendId;
  }

  /**
   * Create an explicit send — the endpoint behind `conduit.send()`.
   *
   * Idempotent by design: repeat the call with the same key (or, absent one, the same
   * content) and you get the ORIGINAL send back rather than a second delivery. That is the
   * guarantee the SDK sells, so it is enforced by a unique index rather than a check.
   */
  async create(request: CreateSendRequest): Promise<SendDto> {
    // What actually gets delivered, and what the dashboard shows as this send's payload.
    const payload: Record<string, unknown> = {
      ...(request.template ? { template: request.template } : {}),
      ...(request.data ? { data: request.data } : {}),
    };

    const dedupeKey = dedupeKeyFor(request.to, request.channel, payload);
    // Absent an explicit key, identical content to the same recipient for the same event is
    // the same send — so a naive retry still can't double-deliver.
    const idempotencyKey =
      request.idempotencyKey ?? `auto:${request.causedBy}:${dedupeKey}`;

    const { send, created } = await this.repo.createExplicitSend({
      eventId: request.causedBy,
      channel: request.channel,
      to: request.to,
      payload,
      idempotencyKey,
      dedupeKey,
      maxAttempts: this.config.deliveryMaxAttempts,
    });

    if (created) {
      // The outbox row was written in the same transaction; the dispatcher picks it up.
      this.stream.publish({ kind: 'send.updated', sendId: send.id, causedBy: send.causedBy });
    }
    return SendsMapper.toDto(send);
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
          // Always target THIS send. Without it a replay would re-derive the recipient from
          // the event, which is wrong for any send the caller created explicitly.
          sendId: send.id,
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
