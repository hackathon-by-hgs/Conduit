import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import type { ListSendsQuery, Paginated, SendDto } from '@conduit/contracts';
import { SendsService } from './sends.service';
import { DeliveryService } from './delivery.service';
import { ListSendsQueryDto } from './dto/list-sends.query';

@Controller('sends')
export class DeliveryController {
  constructor(
    private readonly sends: SendsService,
    private readonly delivery: DeliveryService,
  ) {}

  @Get()
  list(@Query() query: ListSendsQueryDto): Promise<Paginated<SendDto>> {
    return this.sends.list(query as ListSendsQuery);
  }

  @Post(':id/replay')
  replay(@Param('id') id: string): Promise<SendDto> {
    return this.delivery.replay(id);
  }
}
