import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';

export interface ClaimedOutbox {
  id: string;
  payload: unknown;
}

@Injectable()
export class OutboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  countPending(): Promise<number> {
    return this.prisma.outboxJob.count({ where: { status: 'pending' } });
  }

  /**
   * Claim a batch of pending rows with `FOR UPDATE SKIP LOCKED`, run `dispatch` for each,
   * then mark them dispatched — all in ONE short transaction.
   *
   * - SKIP LOCKED: concurrent dispatchers grab disjoint rows and never wait on each other
   *   → deadlock-free by construction.
   * - Crash mid-batch: the transaction rolls back, rows stay `pending`, next tick re-claims
   *   them. Combined with a BullMQ `jobId` in `dispatch`, re-dispatch is idempotent
   *   (at-least-once, never double-enqueued).
   *
   * Returns the number of rows dispatched.
   */
  async drainBatch(
    batchSize: number,
    dispatch: (row: ClaimedOutbox) => Promise<void>,
  ): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string; payload: unknown }>>`
        SELECT "id", "payload"
        FROM "outbox_jobs"
        WHERE "status" = 'pending'
        ORDER BY "createdAt"
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      `;

      if (rows.length === 0) return 0;

      for (const row of rows) {
        await dispatch({ id: row.id, payload: row.payload });
      }

      const ids = rows.map((r) => r.id);
      await tx.$executeRaw`
        UPDATE "outbox_jobs"
        SET "status" = 'dispatched', "dispatchedAt" = now(), "attempts" = "attempts" + 1
        WHERE "id" IN (${Prisma.join(ids)})
      `;

      return rows.length;
    });
  }
}
