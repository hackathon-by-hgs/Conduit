import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import type { ListSendsQuery, Paginated, SendDto } from '@conduit/contracts';
import { SendsService } from './sends.service';
import { DeliveryService } from './delivery.service';
import { ListSendsQueryDto } from './dto/list-sends.query';
import { CreateSendBodyDto } from './dto/create-send.body';

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

  /**
   * Create an outbound send — the endpoint behind `conduit.send()`.
   *
   * Idempotent: repeating the call with the same key returns the original send rather than
   * delivering twice, so a client retry is always safe.
   */
  @Post()
  create(@Body() body: CreateSendBodyDto): Promise<SendDto> {
    return this.delivery.create(body);
  }

  @Post(':id/replay')
  replay(@Param('id') id: string): Promise<SendDto> {
    return this.delivery.replay(id);
  }
}
