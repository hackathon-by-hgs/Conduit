import type { Channel } from '@conduit/contracts';

/** A message to deliver, in channel-neutral form. */
export interface DeliveryRequest {
  /** Recipient: an email address, an E.164 phone number, or a URL, per channel. */
  to: string;
  /** Event type — becomes the email subject / the gist of an SMS. */
  type: string;
  /** The originating webhook payload. */
  payload: Record<string, unknown>;
}

export interface ProviderResult {
  ok: boolean;
  /** HTTP-ish status for the attempt record. 0 when the call never reached the provider. */
  statusCode: number;
  /** Provider receipt (e.g. Resend message id) on success — proof the delivery happened. */
  providerId: string | null;
  error: string | null;
  /**
   * Whether another attempt could plausibly succeed. `false` for terminal faults (bad
   * recipient, rejected key) — retrying those only burns the attempt budget and delays
   * dead-lettering, so the caller dead-letters immediately instead.
   */
  retryable: boolean;
}

/**
 * One channel's delivery implementation. Adding a channel means implementing this and
 * registering it in `ChannelRouter` — no change to the worker, the retry logic, the DLQ,
 * or the reconciler, all of which are channel-agnostic.
 */
export interface DeliveryProvider {
  readonly channel: Channel;
  send(request: DeliveryRequest): Promise<ProviderResult>;
}
