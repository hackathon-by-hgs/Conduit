import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './env.schema';

/** Typed accessors over ConfigService so feature code never touches raw strings. */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get nodeEnv() {
    return this.config.get('NODE_ENV', { infer: true });
  }
  /** Port to bind. A host-injected PORT wins over API_PORT — see the schema for why. */
  get apiPort(): number {
    return (
      this.config.get('PORT', { infer: true }) ??
      this.config.get('API_PORT', { infer: true }) ??
      3001
    );
  }
  get databaseUrl() {
    return this.config.get('DATABASE_URL', { infer: true });
  }
  get redisUrl() {
    return this.config.get('REDIS_URL', { infer: true });
  }
  get webOrigin() {
    return this.config.get('WEB_ORIGIN', { infer: true });
  }
  get resendApiKey() {
    return this.config.get('RESEND_API_KEY', { infer: true });
  }
  get emailFrom() {
    return this.config.get('EMAIL_FROM', { infer: true });
  }

  /** Shared service key. Empty means authentication is disabled (local dev only). */
  get apiKey() {
    return this.config.get('CONDUIT_API_KEY', { infer: true });
  }

  /** Whether ingest HMAC verification is enforced (false = local/mock bypass). */
  get webhookVerifyEnabled() {
    return this.config.get('WEBHOOK_VERIFY', { infer: true });
  }

  get throttleTtlMs() {
    return this.config.get('THROTTLE_TTL_MS', { infer: true });
  }

  get throttleLimit() {
    return this.config.get('THROTTLE_LIMIT', { infer: true });
  }

  get outboxDispatchIntervalMs() {
    return this.config.get('OUTBOX_DISPATCH_INTERVAL_MS', { infer: true });
  }

  get outboxBatchSize() {
    return this.config.get('OUTBOX_BATCH_SIZE', { infer: true });
  }

  /** Whether the worker auto-creates a send for every ingested event (off = SDK-driven). */
  get autoDeliver() {
    return this.config.get('AUTO_DELIVER', { infer: true });
  }

  get deliveryMaxAttempts() {
    return this.config.get('DELIVERY_MAX_ATTEMPTS', { infer: true });
  }

  get deliveryBackoffMs() {
    return this.config.get('DELIVERY_BACKOFF_MS', { infer: true });
  }

  get deliveryBackoffCapMs() {
    return this.config.get('DELIVERY_BACKOFF_CAP_MS', { infer: true });
  }

  get deliveryDedupWindowMs() {
    return this.config.get('DELIVERY_DEDUP_WINDOW_MS', { infer: true });
  }

  get deliveryFailRate() {
    return this.config.get('DELIVERY_FAIL_RATE', { infer: true });
  }

  get reconcileIntervalMs() {
    return this.config.get('RECONCILE_INTERVAL_MS', { infer: true });
  }

  get reconcileNoSendGraceMs() {
    return this.config.get('RECONCILE_NO_SEND_GRACE_MS', { infer: true });
  }

  get reconcileStuckAfterMs() {
    return this.config.get('RECONCILE_STUCK_AFTER_MS', { infer: true });
  }

  /** Per-source HMAC secret, e.g. WEBHOOK_SECRET_STRIPE for source "stripe". */
  webhookSecret(source: string): string | undefined {
    return process.env[`WEBHOOK_SECRET_${source.toUpperCase()}`];
  }
}
