import { z } from 'zod';

/** Typed, validated environment. Unknown keys (e.g. WEBHOOK_SECRET_*) are read via process.env. */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  /**
   * Injected by the host (Render, Fly, Heroku…) to tell the process which port to bind. It
   * wins over API_PORT: bind anywhere else and the platform's health check never connects,
   * so the deploy fails with a service that is actually running fine.
   */
  PORT: z.coerce.number().int().positive().optional(),
  /**
   * A DIRECT Postgres connection string. Prisma connects through the `@prisma/adapter-pg`
   * driver adapter (node-postgres), which speaks the Postgres wire protocol over TCP — so a
   * Prisma Accelerate / Data Proxy URL (`prisma://`, `prisma+postgres://`) cannot work here.
   * Those are HTTP endpoints; the driver dials them on :5432 and hangs until ETIMEDOUT,
   * surfacing as an unrelated-looking failure inside the first query. Reject it at boot.
   */
  DATABASE_URL: z
    .string()
    .min(1)
    .refine((u) => !/^prisma(\+\w+)?:\/\//.test(u), {
      message:
        'DATABASE_URL is a Prisma Accelerate/Data Proxy URL, which the @prisma/adapter-pg ' +
        'driver adapter cannot connect to. Use a direct Postgres connection string ' +
        '(postgresql://user:password@host:5432/database).',
    }),
  REDIS_URL: z.string().min(1),
  WEB_ORIGIN: z.string().min(1).default('http://localhost:3000'),
  RESEND_API_KEY: z.string().default(''),
  EMAIL_FROM: z.string().default('conduit@example.dev'),
  /**
   * Shared key protecting the service. Every route except `POST /webhooks/:source` (which is
   * HMAC-authenticated per source) and `GET /health` requires it.
   *
   * Left EMPTY, authentication is disabled and the API boots with a loud warning — which
   * keeps local dev, the seed script and the mock generator frictionless. Always set it for
   * anything reachable beyond localhost.
   */
  CONDUIT_API_KEY: z.string().default(''),
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
  /**
   * Auto-pilot: every ingested event automatically produces a send, with the recipient read
   * from its payload. Default on, which is what the seed script, webhook generator and demo
   * rely on.
   *
   * Set to false when driving Conduit through the SDK: there, YOUR code decides what to send
   * via `conduit.send()` / `POST /sends`. Leaving it on while also calling send() means an
   * event gets both an automatic delivery and your explicit one — two real messages.
   */
  AUTO_DELIVER: z
    .string()
    .default('true')
    .transform((v) => v !== 'false' && v !== '0'),
  // Delivery worker: retry/backoff/DLQ + near-duplicate collapse window.
  DELIVERY_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  DELIVERY_BACKOFF_MS: z.coerce.number().int().positive().default(1000),
  // Ceiling for the exponential backoff, so a long retry chain can't schedule hours out.
  DELIVERY_BACKOFF_CAP_MS: z.coerce.number().int().positive().default(60_000),
  DELIVERY_DEDUP_WINDOW_MS: z.coerce.number().int().nonnegative().default(1000),
  // Stub provider failure rate [0..1] for exercising retry/DLQ locally.
  DELIVERY_FAIL_RATE: z.coerce.number().min(0).max(1).default(0),
  // Reconciler cadence.
  RECONCILE_INTERVAL_MS: z.coerce.number().int().positive().default(30_000),
  // Grace period before a processed-but-undelivered event counts as a `no_send` gap. Stops
  // deliveries that are merely still in flight (or mid-retry) from being reported as gaps.
  RECONCILE_NO_SEND_GRACE_MS: z.coerce.number().int().nonnegative().default(60_000),
  // How long a send may sit in a non-terminal state before it is reported as `stuck`.
  RECONCILE_STUCK_AFTER_MS: z.coerce.number().int().positive().default(300_000),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(`Invalid environment variables:\n${parsed.error.message}`);
  }
  return parsed.data;
}
