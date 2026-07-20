import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import type { Channel } from '@conduit/contracts';
import { AppConfigService } from '../../../config/config.service';
import type {
  DeliveryProvider,
  DeliveryRequest,
  ProviderResult,
} from '../providers/provider.types';

/** Resend rejects in-band with a `name`; these names are permanent faults. */
const TERMINAL_ERROR_NAMES = new Set([
  'validation_error',
  'invalid_parameter',
  'invalid_access',
  'missing_required_field',
  'restricted_api_key',
  'not_found',
]);

/** 4xx is terminal except timeout / rate-limit, which are worth another attempt. */
function isTerminalStatus(status: number): boolean {
  if (status === 408 || status === 429) return false;
  return status >= 400 && status < 500;
}

/**
 * Email delivery via Resend.
 *
 * Two modes, one code path:
 * - **live** — a real `RESEND_API_KEY` is configured: performs the actual API call and
 *   captures the true provider response (message id, status, error) into the Attempt.
 * - **simulated** — no usable key: no network call, so retry → backoff → DLQ → replay can
 *   still be demonstrated offline.
 *
 * `DELIVERY_FAIL_RATE` injects synthetic failures in BOTH modes. That is how the spec's
 * "provider fails ~15% of sends" harness is reproduced without actually breaking real mail.
 */
@Injectable()
export class ResendProvider implements DeliveryProvider {
  readonly channel: Channel = 'email';
  private readonly logger = new Logger(ResendProvider.name);
  private readonly client: Resend | null;

  constructor(private readonly config: AppConfigService) {
    const key = this.config.resendApiKey;
    // The .env.example placeholder must never be mistaken for a live key.
    this.client = key.startsWith('re_') && key !== 're_replace_me' ? new Resend(key) : null;
    this.logger.log(
      this.client
        ? 'Resend provider in LIVE mode.'
        : 'Resend provider in SIMULATED mode (no usable RESEND_API_KEY) — no email is sent.',
    );
  }

  /** True when a real key is configured and delivery actually hits the network. */
  get isLive(): boolean {
    return this.client !== null;
  }

  async send(request: DeliveryRequest): Promise<ProviderResult> {
    // Injected-failure harness, applied before the network call so a simulated failure
    // costs nothing and never sends real email.
    const failRate = this.config.deliveryFailRate;
    if (failRate > 0 && Math.random() < failRate) {
      return {
        ok: false,
        statusCode: 502,
        providerId: null,
        error: 'provider_unavailable (injected)',
        retryable: true,
      };
    }

    if (!this.client) {
      this.logger.debug(`(simulated) delivered to ${request.to}`);
      return {
        ok: true,
        statusCode: 202,
        providerId: `sim_${randomId()}`,
        error: null,
        retryable: false,
      };
    }

    return this.sendLive(this.client, request);
  }

  private async sendLive(client: Resend, request: DeliveryRequest): Promise<ProviderResult> {
    try {
      const { data, error } = await client.emails.send({
        from: this.config.emailFrom,
        to: request.to,
        subject: `Conduit · ${request.type}`,
        html: renderHtml(request),
      });

      if (error) {
        // Resend surfaces API errors in-band rather than throwing.
        const status = readStatus(error);
        const terminal = TERMINAL_ERROR_NAMES.has(error.name) || isTerminalStatus(status);
        return {
          ok: false,
          statusCode: status,
          providerId: null,
          error: `${error.name}: ${error.message}`,
          retryable: !terminal,
        };
      }

      return {
        ok: true,
        statusCode: 200,
        providerId: data?.id ?? null,
        error: null,
        retryable: false,
      };
    } catch (cause) {
      // Network / DNS / timeout — the provider was never reached, so always retryable.
      const message = cause instanceof Error ? cause.message : String(cause);
      return {
        ok: false,
        statusCode: 0,
        providerId: null,
        error: `transport: ${message}`,
        retryable: true,
      };
    }
  }
}

/**
 * Builds the message body from the event. Kept deliberately small — templating is
 * explicitly out of scope (see the spec's scope guardrails); the point is that a real,
 * inspectable message is derived from the event that caused it.
 */
function renderHtml(request: DeliveryRequest): string {
  const body = escapeHtml(JSON.stringify(request.payload, null, 2));
  return `<p>Event <strong>${escapeHtml(request.type)}</strong> was processed by Conduit.</p><pre>${body}</pre>`;
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Webhook payloads are attacker-controlled; never interpolate them into HTML raw. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

/** Resend error objects carry a numeric statusCode on some paths; default to 502. */
function readStatus(error: object): number {
  const status = (error as { statusCode?: unknown }).statusCode;
  return typeof status === 'number' ? status : 502;
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 12);
}
