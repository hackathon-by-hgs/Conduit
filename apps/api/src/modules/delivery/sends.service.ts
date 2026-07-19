import { Injectable } from '@nestjs/common';
import type { ListSendsQuery, Paginated, SendDto } from '@conduit/contracts';
import { normalizeLimit, toPage } from '../../common/pagination/cursor';
import { SendsRepository } from './sends.repository';
import { SendsMapper } from './sends.mapper';

/** Read API for sends (the DLQ view). Delivery/replay writes live in DeliveryService. */
@Injectable()
export class SendsService {
  constructor(private readonly repo: SendsRepository) {}

  async list(query: ListSendsQuery): Promise<Paginated<SendDto>> {
    const limit = normalizeLimit(query.limit);
    const { rows, total } = await this.repo.findMany({
      status: query.status,
      cursor: query.cursor,
      limit,
    });
    const page = toPage(rows, limit, total, (r) => r.id);
    return { ...page, items: page.items.map(SendsMapper.toDto) };
  }
}
