import { Injectable } from '@nestjs/common';
import type { EventStatus } from '@conduit/contracts';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { Prisma, WebhookEvent } from '../../generated/prisma/client';

export type EventRow = WebhookEvent;
export type EventRowDetailed = Prisma.WebhookEventGetPayload<{
  include: { sends: { include: { attemptHistory: true } } };
}>;

export interface FindEventsParams {
  status?: EventStatus;
  source?: string;
  cursor?: string;
  limit: number;
  from?: string;
  to?: string;
}

@Injectable()
export class EventsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<EventRowDetailed | null> {
    return this.prisma.webhookEvent.findUnique({
      where: { id },
      include: { sends: { include: { attemptHistory: { orderBy: { attemptNo: 'asc' } } } } },
    });
  }

  async findMany(params: FindEventsParams): Promise<{ rows: EventRow[]; total: number }> {
    const { status, source, cursor, limit, from, to } = params;
    const where: Prisma.WebhookEventWhereInput = {
      ...(status ? { status } : {}),
      ...(source ? { source } : {}),
      ...(from || to
        ? {
            receivedAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.webhookEvent.findMany({
        where,
        take: limit + 1, // +1 to detect the next page
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        // Total ordering (receivedAt is non-unique) so keyset pagination can't skip/repeat.
        orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.webhookEvent.count({ where }),
    ]);

    return { rows, total };
  }
}
