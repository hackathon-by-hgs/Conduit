import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { QUEUE_NAMES } from '../../queue/queue.constants';
import type { DeliveryJobData } from '../../queue/job.types';
import { KeyedSerializer } from '../../queue/source-serializer';

/**
 * Consumes enqueued webhook events and delivers them.
 *
 * BE1 owns the ordering primitive (P2): the worker runs with concurrency so different
 * sources deliver in parallel, but a per-source serializer keeps same-source jobs in FIFO
 * order. BE2 plugs the real delivery into `handle()`.
 *
 * TODO(BE2 · P0 · Day 1): create Send rows with `causedBy` set, deliver via ResendProvider,
 * record each Attempt, retry with exponential backoff + jitter, and dead-letter after max
 * attempts. On each status change, publish a StreamService event so SSE clients refetch.
 */
@Processor(QUEUE_NAMES.delivery, { concurrency: 10 })
export class DeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger(DeliveryProcessor.name);
  private readonly perSource = new KeyedSerializer();

  process(job: Job<DeliveryJobData>): Promise<void> {
    // Serialize per source key so ordering holds within a source.
    return this.perSource.run(job.data.source, () => this.handle(job));
  }

  private async handle(job: Job<DeliveryJobData>): Promise<void> {
    this.logger.log(
      `(stub) delivering event ${job.data.eventId} [source=${job.data.source}]`,
    );
    await Promise.resolve();
  }
}
