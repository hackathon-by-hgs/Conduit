import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { backoffWithJitter } from '../../common/retry/backoff';
import { Prisma, type Send, type WebhookEvent } from '../../generated/prisma/client';

export type EnsureStatus = 'created' | 'resumed' | 'deduped' | 'already_terminal';
export type AttemptOutcome = 'sent' | 'retry' | 'dead_lettered';

export interface EnsureSendParams {
  eventId: string;
  source: string;
  to: string;
  channel: string;
  payload: Record<string, unknown>;
  dedupeKey: string;
  dedupeWindowMs: number;
  /** Attempts this send may make before dead-lettering (DELIVERY_MAX_ATTEMPTS). */
  maxAttempts: number;
}

@Injectable()
export class DeliveryRepository {
  constructor(private readonly prisma: PrismaService) {}

  getEvent(eventId: string): Promise<WebhookEvent | null> {
    return this.prisma.webhookEvent.findUnique({ where: { id: eventId } });
  }

  /**
   * Idempotently ensure a Send exists for an event. Per-source ordering is enforced with a
   * single Postgres advisory lock (parallel across sources, serial within one) — one lock
   * per job, so there is no lock cycle and no deadlock. Near-duplicate deliveries (same
   * recipient+content within the window) collapse into the earlier send.
   */
  async ensureSend(
    params: EnsureSendParams,
  ): Promise<{ sendId: string | null; status: EnsureStatus }> {
    return this.prisma.$transaction(async (tx) => {
      // Serialize per source; held only for this short transaction. The lock is acquired
      // as a side effect of the subquery; we select a mappable column (Prisma can't
      // deserialize the `void` return of pg_advisory_xact_lock directly).
      await tx.$queryRaw`SELECT 1 AS ok FROM (SELECT pg_advisory_xact_lock(hashtext(${params.source}))) AS _lock`;

      // Idempotent: a retry / re-delivery of the same event reuses its send.
      const existing = await tx.send.findFirst({ where: { causedBy: params.eventId } });
      if (existing) {
        const terminal = existing.status === 'sent' || existing.status === 'dead_lettered';
        return { sendId: existing.id, status: terminal ? 'already_terminal' : 'resumed' };
      }

      // Delivery dedup: a DIFFERENT event delivered the same content to the same recipient
      // within the window → collapse (no second send).
      const windowStart = new Date(Date.now() - params.dedupeWindowMs);
      const recent = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "sends"
        WHERE "dedupeKey" = ${params.dedupeKey}
          AND "createdAt" > ${windowStart}
          AND "causedBy" <> ${params.eventId}
        ORDER BY "createdAt" DESC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `;
      if (recent.length > 0) {
        // Record WHICH send absorbed this event: it is processed but will never own a send,
        // and the reconciler needs to tell that apart from a genuinely missing delivery.
        await this.markProcessed(tx, params.eventId, recent[0]?.id ?? null);
        return { sendId: recent[0]?.id ?? null, status: 'deduped' };
      }

      const send = await tx.send.create({
        data: {
          causedBy: params.eventId,
          channel: params.channel,
          to: params.to,
          payload: params.payload as Prisma.InputJsonValue,
          status: 'pending',
          dedupeKey: params.dedupeKey,
          attemptBudget: params.maxAttempts,
        },
      });
      await this.markProcessed(tx, params.eventId);
      return { sendId: send.id, status: 'created' };
    });
  }

  /**
   * Record one attempt and transition the send. Short, single-row transaction.
   *
   * The retry budget is read from the SEND ROW (`attemptBudget`), not from config, so a
   * replayed send — whose budget was extended on replay — gets real retries instead of
   * dead-lettering on its first attempt. A `retryable: false` provider result (bad address,
   * rejected key) skips the remaining budget and dead-letters immediately.
   */
  async recordAttempt(params: {
    sendId: string;
    ok: boolean;
    statusCode: number | null;
    providerId: string | null;
    error: string | null;
    durationMs: number;
    retryable: boolean;
    backoffMs: number;
    backoffCapMs: number;
  }): Promise<{ outcome: AttemptOutcome; causedBy: string; attemptNo: number }> {
    return this.prisma.$transaction(async (tx) => {
      const send = await tx.send.findUniqueOrThrow({ where: { id: params.sendId } });
      const attemptNo = send.attempts + 1;
      const budgetLeft = attemptNo < send.attemptBudget;
      const willRetry = !params.ok && params.retryable && budgetLeft;
      const outcome: AttemptOutcome = params.ok ? 'sent' : willRetry ? 'retry' : 'dead_lettered';

      await tx.attempt.create({
        data: {
          sendId: params.sendId,
          attemptNo,
          statusCode: params.statusCode,
          providerId: params.providerId,
          error: params.error,
          durationMs: params.durationMs,
          // Same function + seed the queue's backoff strategy uses, so the timeline the
          // dashboard renders is the schedule BullMQ actually follows.
          nextRetryAt: willRetry
            ? new Date(
                Date.now() +
                  backoffWithJitter(attemptNo, params.backoffMs, params.backoffCapMs, send.causedBy),
              )
            : null,
        },
      });
      await tx.send.update({
        where: { id: params.sendId },
        data: {
          attempts: attemptNo,
          status: outcome === 'retry' ? 'failed' : outcome,
          lastError: params.ok ? null : params.error,
          deliveredAt: params.ok ? new Date() : null,
        },
      });
      return { outcome, causedBy: send.causedBy, attemptNo };
    });
  }

  /**
   * Idempotent replay: only a `dead_lettered` send is reset to `pending`; any other status
   * is a no-op. The row is locked FOR UPDATE, so a double-click can't reset twice.
   *
   * The attempt budget is EXTENDED by `extraAttempts` rather than `attempts` being reset —
   * a replayed send therefore gets a genuine retry budget while `attemptNo` stays monotonic
   * and the previous attempt history remains intact and auditable.
   */
  async claimForReplay(
    sendId: string,
    extraAttempts: number,
  ): Promise<{ replayed: boolean; send: Send }> {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string; status: string }>>`
        SELECT "id", "status" FROM "sends" WHERE "id" = ${sendId} FOR UPDATE
      `;
      if (locked.length === 0) {
        throw new NotFoundException(`Send ${sendId} not found`);
      }
      if (locked[0]?.status !== 'dead_lettered') {
        const send = await tx.send.findUniqueOrThrow({ where: { id: sendId } });
        return { replayed: false, send };
      }
      const send = await tx.send.update({
        where: { id: sendId },
        data: {
          status: 'pending',
          lastError: null,
          attemptBudget: { increment: extraAttempts },
        },
      });
      return { replayed: true, send };
    });
  }

  private markProcessed(
    tx: Prisma.TransactionClient,
    eventId: string,
    collapsedInto: string | null = null,
  ): Promise<unknown> {
    return tx.webhookEvent.update({
      where: { id: eventId },
      data: {
        status: 'processed',
        processedAt: new Date(),
        ...(collapsedInto ? { collapsedInto } : {}),
      },
    });
  }
}
