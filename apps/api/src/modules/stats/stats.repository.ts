import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class StatsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * All dashboard counts in ONE transaction, so the cards are a consistent snapshot —
   * otherwise "events received" and "sends delivered" could be read either side of a
   * concurrent write and appear to contradict each other.
   */
  async counts(): Promise<{
    eventsReceived: number;
    eventsProcessed: number;
    duplicatesRejected: number;
    sendsDelivered: number;
    sendsInDlq: number;
    openGaps: number;
  }> {
    const [eventsReceived, eventsProcessed, duplicates, sendsDelivered, sendsInDlq, openGaps] =
      await this.prisma.$transaction([
        this.prisma.webhookEvent.count(),
        this.prisma.webhookEvent.count({ where: { status: 'processed' } }),
        this.prisma.webhookEvent.aggregate({ _sum: { duplicateCount: true } }),
        this.prisma.send.count({ where: { status: 'sent' } }),
        this.prisma.send.count({ where: { status: 'dead_lettered' } }),
        this.prisma.reconcileGap.count({ where: { resolvedAt: null } }),
      ]);

    return {
      eventsReceived,
      eventsProcessed,
      // _sum is null when there are no rows at all.
      duplicatesRejected: duplicates._sum.duplicateCount ?? 0,
      sendsDelivered,
      sendsInDlq,
      openGaps,
    };
  }
}
