import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { QUEUE_NAMES } from '../../queue/queue.constants';
import type { DeliveryJobData } from '../../queue/job.types';
import { DeliveryService } from './delivery.service';

/**
 * Consumes delivery jobs. Ordering + dedup + idempotency live in DeliveryService (per-row
 * and per-source locks — deadlock-free). Worker lock/stalled settings let BullMQ re-deliver
 * a job whose worker crashed mid-flight; because processing is idempotent, re-delivery is safe.
 */
@Processor(QUEUE_NAMES.delivery, {
  concurrency: 10,
  lockDuration: 30_000,
  stalledInterval: 30_000,
  maxStalledCount: 2,
})
export class DeliveryProcessor extends WorkerHost {
  constructor(private readonly delivery: DeliveryService) {
    super();
  }

  process(job: Job<DeliveryJobData>): Promise<void> {
    return this.delivery.processDelivery(job.data);
  }
}
