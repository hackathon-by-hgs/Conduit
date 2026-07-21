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

/**
 * Redis connection options from a URL.
 *
 * Every part matters in production and none of it does locally, which is exactly how this
 * kind of bug ships: managed Redis hands out a `rediss://` URL (TLS) with a `default`
 * username, and dropping either the scheme or the username produces a connection that fails
 * to authenticate — after deploy, not in dev.
 */
export function redisConnection(redisUrl: string): {
  host: string;
  port: number;
  username?: string;
  password?: string;
  tls?: Record<string, never>;
} {
  const url = new URL(redisUrl);
  const secure = url.protocol === 'rediss:';
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    ...(secure ? { tls: {} } : {}),
  };
}

/** Global BullMQ connection. Individual modules `registerQueue` the queues they use. */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => {
        return {
          connection: redisConnection(config.redisUrl),
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
