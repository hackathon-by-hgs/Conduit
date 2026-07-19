import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DeliveryController } from './delivery.controller';
import { SendsService } from './sends.service';
import { SendsRepository } from './sends.repository';
import { DeliveryService } from './delivery.service';
import { DeliveryRepository } from './delivery.repository';
import { DeliveryProcessor } from './delivery.processor';
import { ResendProvider } from './email/resend.provider';
import { StreamModule } from '../stream/stream.module';
import { QUEUE_NAMES } from '../../queue/queue.constants';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_NAMES.delivery }), StreamModule],
  controllers: [DeliveryController],
  providers: [
    SendsService,
    SendsRepository,
    DeliveryService,
    DeliveryRepository,
    DeliveryProcessor,
    ResendProvider,
  ],
  exports: [SendsService, SendsRepository],
})
export class DeliveryModule {}
