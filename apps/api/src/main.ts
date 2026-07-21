import 'reflect-metadata';
import './load-env';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { AppConfigService } from './config/config.service';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // HMAC must be computed over the exact bytes received on /webhooks.
    rawBody: true,
  });

  const config = app.get(AppConfigService);

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.enableCors({ origin: config.webOrigin, credentials: true });

  // 0.0.0.0, not localhost: a container's health check and router reach the process from
  // outside it, and a loopback-only bind is invisible there.
  await app.listen(config.apiPort, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`Conduit API listening on port ${config.apiPort}`);
}

void bootstrap();
