import type { ApiError } from '@conduit/contracts';

/**
 * A non-2xx response from the Conduit API, carrying the server's error envelope so callers
 * can branch on a stable `code` rather than parsing messages.
 */
export class ConduitError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;
  readonly path?: string;

  constructor(error: ApiError) {
    super(error.message);
    this.name = 'ConduitError';
    this.statusCode = error.statusCode;
    this.code = error.code;
    this.details = error.details;
    this.path = error.path;
  }

  /** True when retrying could plausibly succeed (server-side fault or rate limit). */
  get retryable(): boolean {
    return this.statusCode >= 500 || this.statusCode === 429;
  }
}

/**
 * The incoming webhook's signature did not match. Thrown by `handle()` BEFORE anything is
 * forwarded, so an unverified payload never reaches the event log.
 */
export class ConduitSignatureError extends Error {
  readonly source: string;

  constructor(source: string, reason: string) {
    super(`Webhook signature rejected for source "${source}": ${reason}`);
    this.name = 'ConduitSignatureError';
    this.source = source;
  }
}

/** The request never got an answer — network failure, DNS, or the client-side timeout. */
export class ConduitTransportError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options as ErrorOptions);
    this.name = 'ConduitTransportError';
  }
}
