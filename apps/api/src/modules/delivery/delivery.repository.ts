import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
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
        await this.markProcessed(tx, params.eventId);
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
        },
      });
      await this.markProcessed(tx, params.eventId);
      return { sendId: send.id, status: 'created' };
    });
  }

  /** Record one attempt and transition the send. Short, single-row transaction. */
  async recordAttempt(params: {
    sendId: string;
    ok: boolean;
    statusCode: number | null;
    error: string | null;
    durationMs: number;
    maxAttempts: number;
    backoffMs: number;
  }): Promise<{ outcome: AttemptOutcome; causedBy: string }> {
    return this.prisma.$transaction(async (tx) => {
      const send = await tx.send.findUniqueOrThrow({ where: { id: params.sendId } });
      const attemptNo = send.attempts + 1;
      const willRetry = !params.ok && attemptNo < params.maxAttempts;
      const outcome: AttemptOutcome = params.ok
        ? 'sent'
        : willRetry
          ? 'retry'
          : 'dead_lettered';

      await tx.attempt.create({
        data: {
          sendId: params.sendId,
          attemptNo,
          statusCode: params.statusCode,
          error: params.error,
          durationMs: params.durationMs,
          nextRetryAt: willRetry
            ? new Date(Date.now() + params.backoffMs * 2 ** (attemptNo - 1))
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
      return { outcome, causedBy: send.causedBy };
    });
  }

  /**
   * Idempotent replay: only a `dead_lettered` send is reset to `pending`; any other status
   * is a no-op. The row is locked FOR UPDATE, so a double-click can't reset twice.
   */
  async claimForReplay(sendId: string): Promise<{ replayed: boolean; send: Send }> {
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
        data: { status: 'pending', lastError: null },
      });
      return { replayed: true, send };
    });
  }

  private markProcessed(tx: Prisma.TransactionClient, eventId: string): Promise<unknown> {
    return tx.webhookEvent.update({
      where: { id: eventId },
      data: { status: 'processed', processedAt: new Date() },
    });
  }
}
