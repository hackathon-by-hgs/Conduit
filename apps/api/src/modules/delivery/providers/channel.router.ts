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
    // No recipient in the payload. Email gets a per-source sink so the demo still flows;
    // SMS has no sensible default, so it fails validation in the provider and dead-letters.
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
