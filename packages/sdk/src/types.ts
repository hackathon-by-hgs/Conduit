import type { Channel } from '@conduit/contracts';
import type { FetchLike } from './http';

/** Raw bytes plus the signature header — what signature verification actually needs. */
export interface HandleInput {
  rawBody: Buffer | string;
  signature?: string;
}

export interface HandleOptions {
  /** Which producer this webhook came from, e.g. "stripe". Becomes the URL segment. */
  source: string;
  /**
   * Shared secret for this source. Used to verify the incoming signature locally, and to
   * re-sign when forwarding. It must match the service's `WEBHOOK_SECRET_<SOURCE>`.
   */
  secret: string;
  /**
   * Skip local verification and let the service be the only checker. Off by default —
   * verifying first means a forged payload costs no network call and never reaches the log.
   */
  skipVerify?: boolean;
}

/**
 * A send request. `type` mirrors the spec's SDK surface (`type: "email"`); it maps to the
 * `channel` field the API and dashboard use.
 */
export interface SendInput {
  type: Channel;
  /** Email address, E.164 phone number, or URL, per channel. */
  to: string;
  /** → the id returned by `handle()`. The thread the reconciler follows. */
  causedBy: string;
  template?: string;
  data?: Record<string, unknown>;
  /**
   * Exactly-once key. Repeat a call with the same key and the ORIGINAL send comes back
   * instead of a second delivery. Derived from the content when omitted.
   */
  idempotencyKey?: string;
}

export interface ConduitOptions {
  /** Base URL of the Conduit service, e.g. "http://localhost:3001". */
  baseUrl: string;
  /**
   * Shared service key, sent as `Authorization: Bearer <key>` on every request. Required
   * unless the service is running with `CONDUIT_API_KEY` unset (local development).
   *
   * This is a server-side secret. Never ship it to a browser — put a proxy in front and
   * attach the key there, which is what the Conduit dashboard does.
   */
  apiKey?: string;
  /** Defaults to global `fetch`. Override for tests, proxies, or instrumentation. */
  fetch?: FetchLike;
  /** Client-side timeout per request. Default 10s. */
  timeoutMs?: number;
}
