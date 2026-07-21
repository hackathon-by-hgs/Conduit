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

  getSend(sendId: string): Promise<Send | null> {
    return this.prisma.send.findUnique({ where: { id: sendId } });
  }

  /**
   * Create an explicit send — the `POST /sends` / `conduit.send()` path, where the CALLER
   * decides the recipient and content rather than the worker inferring them from the event.
   *
   * The send row and its outbox row are written in ONE transaction, so "the send exists" and
   * "the delivery is queued" commit together. That reuses the same crash-safe hand-off BE1
   * built for ingest: if the process dies here, the dispatcher re-drains on boot.
   *
   * Exactly-once: a repeat call with the same `idempotencyKey` loses the unique-index race
   * and returns the ORIGINAL send instead of delivering a second time.
   */
  async createExplicitSend(params: {
    eventId: string;
    channel: string;
    to: string;
    payload: Record<string, unknown>;
    idempotencyKey: string;
    dedupeKey: string;
    maxAttempts: number;
  }): Promise<{ send: Send; created: boolean }> {
    try {
      const send = await this.prisma.$transaction(async (tx) => {
        const event = await tx.webhookEvent.findUnique({ where: { id: params.eventId } });
        if (!event) {
          throw new NotFoundException(`Event ${params.eventId} not found`);
        }

        const created = await tx.send.create({
          data: {
            causedBy: params.eventId,
            channel: params.channel,
            to: params.to,
            payload: params.payload as Prisma.InputJsonValue,
            status: 'pending',
            dedupeKey: params.dedupeKey,
            idempotencyKey: params.idempotencyKey,
            attemptBudget: params.maxAttempts,
          },
        });

        await tx.outboxJob.create({
          data: {
            eventId: params.eventId,
            payload: {
              eventId: params.eventId,
              source: event.source,
              receivedAt: event.receivedAt.toISOString(),
              sendId: created.id,
            },
          },
        });

        // Creating a send IS the decision about how to handle this event, so mark it
        // processed — exactly as the auto-pilot path does. Without this the event would sit
        // at `received` forever, and the reconciler (which only judges processed events)
        // would both ignore a send that never lands AND flag this healthy one as an
        // `orphan_send`, since that means "terminal send whose event isn't processed".
        await this.markProcessed(tx, params.eventId);

        return created;
      });
      return { send, created: true };
    } catch (error) {
      if (isUniqueViolation(error)) {
        const existing = await this.prisma.send.findUniqueOrThrow({
          where: { idempotencyKey: params.idempotencyKey },
        });
        return { send: existing, created: false };
      }
      throw error;
    }
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

      // Idempotent: a retry / re-delivery of the same event reuses its send. Scoped to
      // auto-created sends (null idempotencyKey) so an explicit `POST /sends` for the same
      // event is never mistaken for this one's work.
      const existing = await tx.send.findFirst({
        where: { causedBy: params.eventId, idempotencyKey: null },
      });
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

/** Prisma reports a unique-constraint failure as P2002. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002'
  );
}
