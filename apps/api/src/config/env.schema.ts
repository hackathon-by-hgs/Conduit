import { z } from 'zod';

/** Typed, validated environment. Unknown keys (e.g. WEBHOOK_SECRET_*) are read via process.env. */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  WEB_ORIGIN: z.string().min(1).default('http://localhost:3000'),
  RESEND_API_KEY: z.string().default(''),
  EMAIL_FROM: z.string().default('conduit@example.dev'),
  // Ingest HMAC verification. Default on; set to 'false'/'0' to bypass locally (mock/FE dev).
  WEBHOOK_VERIFY: z
    .string()
    .default('true')
    .transform((v) => v !== 'false' && v !== '0'),
  // Ingest rate limiting (per client IP).
  THROTTLE_TTL_MS: z.coerce.number().int().positive().default(10_000),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),
  // Outbox dispatcher (drains persisted delivery intents to BullMQ).
  OUTBOX_DISPATCH_INTERVAL_MS: z.coerce.number().int().positive().default(1000),
  OUTBOX_BATCH_SIZE: z.coerce.number().int().positive().default(100),
  // Delivery worker: retry/backoff/DLQ + near-duplicate collapse window.
  DELIVERY_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  DELIVERY_BACKOFF_MS: z.coerce.number().int().positive().default(1000),
  DELIVERY_DEDUP_WINDOW_MS: z.coerce.number().int().nonnegative().default(1000),
  // Stub provider failure rate [0..1] for exercising retry/DLQ locally.
  DELIVERY_FAIL_RATE: z.coerce.number().min(0).max(1).default(0),
  // Reconciler cadence.
  RECONCILE_INTERVAL_MS: z.coerce.number().int().positive().default(30_000),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(`Invalid environment variables:\n${parsed.error.message}`);
  }
  return parsed.data;
}
