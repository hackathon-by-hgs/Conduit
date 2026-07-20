import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { OutboxRepository } from './outbox.repository';
import { OutboxDispatcher } from './outbox.dispatcher';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_NAMES.delivery })],
  providers: [OutboxRepository, OutboxDispatcher],
  exports: [OutboxRepository],
})
export class OutboxModule {}
