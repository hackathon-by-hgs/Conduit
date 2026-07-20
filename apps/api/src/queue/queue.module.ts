import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import type { AdvancedOptions, MinimalJob } from 'bullmq';
import { AppConfigService } from '../config/config.service';
import { backoffWithJitter } from '../common/retry/backoff';
import type { DeliveryJobData } from './job.types';

/** Name of the custom (jittered) backoff strategy registered on the queue's workers. */
export const JITTERED_BACKOFF = 'jittered';

/**
 * Worker-side settings implementing exponential backoff WITH jitter. BullMQ resolves a
 * named backoff strategy from the WORKER's settings (not the queue's), and `@Processor`
 * takes a static options object, so the two tunables are read from the environment here
 * rather than through `AppConfigService`. `AppConfigModule` has already validated and
 * defaulted them by the time a worker runs, and `env.schema.ts` remains their one
 * definition — these fallbacks only mirror its defaults.
 */
export function jitteredBackoffSettings(): AdvancedOptions {
  const baseMs = Number(process.env.DELIVERY_BACKOFF_MS ?? 1000);
  const capMs = Number(process.env.DELIVERY_BACKOFF_CAP_MS ?? 60_000);
  return {
    backoffStrategy: (
      attemptsMade: number,
      _type?: string,
      _err?: Error,
      job?: MinimalJob,
    ): number => {
      // Seeded on the event id so the worker's persisted `Attempt.nextRetryAt` and this
      // delay are the same number — the rendered delivery timeline is the real schedule.
      const seed = (job?.data as DeliveryJobData | undefined)?.eventId ?? job?.id ?? '';
      return backoffWithJitter(Math.max(1, attemptsMade), baseMs, capMs, seed);
    },
  };
}

/** Global BullMQ connection. Individual modules `registerQueue` the queues they use. */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => {
        const url = new URL(config.redisUrl);
        return {
          connection: {
            host: url.hostname,
            port: url.port ? Number(url.port) : 6379,
            ...(url.password ? { password: url.password } : {}),
          },
          defaultJobOptions: {
            // The DB attempt budget is what actually decides dead-lettering; BullMQ's
            // attempt count must therefore be at least as large, or the queue would stop
            // retrying before the send has spent its budget.
            attempts: config.deliveryMaxAttempts,
            backoff: { type: JITTERED_BACKOFF },
            removeOnComplete: 1000,
            removeOnFail: false,
          },
        };
      },
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
