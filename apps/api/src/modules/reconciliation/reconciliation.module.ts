import { Module } from '@nestjs/common';
import { ReconciliationController } from './reconciliation.controller';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationRepository } from './reconciliation.repository';
import { StreamModule } from '../stream/stream.module';

@Module({
  imports: [StreamModule],
  controllers: [ReconciliationController],
  providers: [ReconciliationService, ReconciliationRepository],
  exports: [ReconciliationService, ReconciliationRepository],
})
export class ReconciliationModule {}
