import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DELIVERY_JOB_NAME } from '../../queue/job.types';
import type { Prisma, WebhookEvent } from '../../generated/prisma/client';

export type WebhookEventRow = WebhookEvent;

export interface CreateEventData {
  source: string;
  type: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  signature?: string | null;
}

@Injectable()
export class WebhooksRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Atomic, idempotent ingest. In ONE interactive transaction we persist the event AND
   * write an outbox row (the delivery hand-off) — so "persisted" and "enqueue intent"
   * commit together or not at all. Idempotency is enforced by the DB (`@@unique([source,
   * idempotencyKey])`); a duplicate rolls the whole transaction back and returns the
   * original event with no second outbox row.
   */
  async createIfNew(
    data: CreateEventData,
  ): Promise<{ event: WebhookEventRow; duplicate: boolean }> {
    try {
      const event = await this.prisma.$transaction(async (tx) => {
        const created = await tx.webhookEvent.create({
          data: {
            source: data.source,
            type: data.type,
            idempotencyKey: data.idempotencyKey,
            payload: data.payload as Prisma.InputJsonValue,
            signature: data.signature ?? null,
          },
        });
        await tx.outboxJob.create({
          data: {
            eventId: created.id,
            type: DELIVERY_JOB_NAME,
            payload: {
              eventId: created.id,
              source: created.source,
              receivedAt: created.receivedAt.toISOString(),
            },
          },
        });
        return created;
      });
      return { event, duplicate: false };
    } catch (error) {
      if (isUniqueViolation(error, 'idempotencyKey')) {
        const existing = await this.prisma.webhookEvent.findFirstOrThrow({
          where: { source: data.source, idempotencyKey: data.idempotencyKey },
        });
        return { event: existing, duplicate: true };
      }
      throw error;
    }
  }
}

/** Prisma unique-constraint failure is code P2002; `meta.target` names the field(s)/index. */
function isUniqueViolation(error: unknown, field: string): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false;
  if ((error as { code?: string }).code !== 'P2002') return false;
  const target = (error as { meta?: { target?: string[] | string } }).meta?.target;
  if (!target) return true;
  return Array.isArray(target) ? target.includes(field) : String(target).includes(field);
}
