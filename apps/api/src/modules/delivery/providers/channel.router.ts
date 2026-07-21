import { Injectable, Logger } from '@nestjs/common';
import { CHANNEL, type Channel } from '@conduit/contracts';
import { ResendProvider } from '../email/resend.provider';
import { SmsProvider } from '../sms/sms.provider';
import type { DeliveryProvider, DeliveryRequest, ProviderResult } from './provider.types';

/** Fallback when a payload doesn't say which channel it wants. */
const DEFAULT_CHANNEL: Channel = 'email';

function isChannel(value: unknown): value is Channel {
  return typeof value === 'string' && (CHANNEL as readonly string[]).includes(value);
}

/**
 * Routes a delivery to the provider for its channel.
 *
 * The channel and recipient are read from the inbound webhook payload (`channel` / `to`),
 * which keeps the SDK surface in the spec honest — `conduit.send({ type, to, ... })` is the
 * caller's declaration of intent, carried through the event log to the worker.
 *
 * Everything downstream of this class — attempts, backoff, DLQ, replay, reconciliation — is
 * channel-agnostic, so a new channel needs a `DeliveryProvider` and one line here.
 */
@Injectable()
export class ChannelRouter {
  private readonly logger = new Logger(ChannelRouter.name);
  private readonly providers: Map<Channel, DeliveryProvider>;

  constructor(email: ResendProvider, sms: SmsProvider) {
    this.providers = new Map<Channel, DeliveryProvider>([
      [email.channel, email],
      [sms.channel, sms],
    ]);
  }

  /**
   * Which channel an event should be delivered on. An unrecognised `channel` value falls
   * back to email with a warning rather than failing the send — the event is already
   * durably stored, and dropping it would violate the whole premise.
   */
  resolveChannel(payload: Record<string, unknown>): Channel {
    const requested = payload.channel;
    if (requested === undefined) return DEFAULT_CHANNEL;
    if (isChannel(requested) && this.providers.has(requested)) return requested;
    this.logger.warn(`Unsupported channel ${JSON.stringify(requested)}; falling back to email.`);
    return DEFAULT_CHANNEL;
  }

  /** Recipient for a channel, defaulting to a per-source sink when the payload omits one. */
  resolveRecipient(payload: Record<string, unknown>, channel: Channel, source: string): string {
    if (typeof payload.to === 'string' && payload.to.length > 0) return payload.to;

    // No explicit `to`. A gateway posts its own envelope rather than Conduit's, so for email
    // look where a payer's address actually lives — Monnify nests it under
    // `eventData.customer.email`. This is the difference between a real receipt and a sink.
    if (channel === 'email') {
      const nested =
        readString(payload, 'eventData', 'customer', 'email') ??
        readString(payload, 'customer', 'email');
      if (nested) return nested;
    }

    // Nothing usable. Email gets a per-source sink so the demo still flows; SMS has no
    // sensible default, so it fails validation in the provider and dead-letters.
    return channel === 'email' ? `${source}@webhooks.conduit.dev` : '';
  }

  send(channel: Channel, request: DeliveryRequest): Promise<ProviderResult> {
    const provider = this.providers.get(channel);
    if (!provider) {
      // Unreachable via resolveChannel, but a direct caller could still get here.
      return Promise.resolve({
        ok: false,
        statusCode: 422,
        providerId: null,
        error: `unsupported_channel: ${channel}`,
        retryable: false,
      });
    }
    return provider.send(request);
  }
}

/** Walk a nested path, returning the value only if it bottoms out in a non-empty string. */
function readString(root: Record<string, unknown>, ...path: string[]): string | undefined {
  let node: unknown = root;
  for (const key of path) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[key];
  }
  return typeof node === 'string' && node.length > 0 ? node : undefined;
}
