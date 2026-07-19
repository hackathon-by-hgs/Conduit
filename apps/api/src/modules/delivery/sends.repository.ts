import { Injectable } from '@nestjs/common';
import type { SendStatus } from '@conduit/contracts';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { Attempt, Prisma, Send } from '../../generated/prisma/client';

export type SendRow = Send;
export type SendRowWithAttempts = Prisma.SendGetPayload<{ include: { attemptHistory: true } }>;
export type AttemptRow = Attempt;

@Injectable()
export class SendsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<SendRowWithAttempts | null> {
    return this.prisma.send.findUnique({
      where: { id },
      include: { attemptHistory: { orderBy: { attemptNo: 'asc' } } },
    });
  }

  async findMany(params: {
    status?: SendStatus;
    cursor?: string;
    limit: number;
  }): Promise<{ rows: SendRow[]; total: number }> {
    const { status, cursor, limit } = params;
    const where: Prisma.SendWhereInput = { ...(status ? { status } : {}) };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.send.findMany({
        where,
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        // Total ordering (createdAt is non-unique) so keyset pagination can't skip/repeat.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.send.count({ where }),
    ]);

    return { rows, total };
  }
}
