import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AppConfigService } from '../config/config.service';

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
            // Retry with exponential backoff; the DB attempt count drives DLQ, so attempts
            // must cover maxAttempts. (Jitter is a TODO — BullMQ needs a custom strategy.)
            attempts: config.deliveryMaxAttempts,
            backoff: { type: 'exponential', delay: config.deliveryBackoffMs },
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
