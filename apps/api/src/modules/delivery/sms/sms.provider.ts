import { Injectable, Logger } from '@nestjs/common';
import type { Channel } from '@conduit/contracts';
import { AppConfigService } from '../../../config/config.service';
import type {
  DeliveryProvider,
  DeliveryRequest,
  ProviderResult,
} from '../providers/provider.types';

/** E.164: a leading +, a non-zero country digit, then up to 14 more digits. */
const E164 = /^\+[1-9]\d{1,14}$/;

/** SMS bodies are one segment by convention here; longer text is truncated with an ellipsis. */
const MAX_BODY_CHARS = 160;

/**
 * SMS delivery — a **log-only stub** (P2 in the build plan). No SMS is ever sent and no
 * provider SDK is wired up.
 *
 * It is deliberately not a no-op that always succeeds: it validates the recipient and
 * honours `DELIVERY_FAIL_RATE`, so an SMS send exercises exactly the same retry, backoff,
 * DLQ, replay and reconciliation paths as email. That is the point of the stub — it proves
 * the reliability machinery is genuinely channel-agnostic rather than email-shaped.
 *
 * Swapping in a real provider (Twilio et al.) means replacing `deliver()` below; nothing
 * else in the pipeline changes.
 */
@Injectable()
export class SmsProvider implements DeliveryProvider {
  readonly channel: Channel = 'sms';
  private readonly logger = new Logger(SmsProvider.name);

  constructor(private readonly config: AppConfigService) {}

  async send(request: DeliveryRequest): Promise<ProviderResult> {
    // A malformed number can never succeed, so don't spend the attempt budget on it.
    if (!E164.test(request.to)) {
      return {
        ok: false,
        statusCode: 422,
        providerId: null,
        error: `invalid_recipient: "${request.to}" is not an E.164 phone number`,
        retryable: false,
      };
    }

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

    return Promise.resolve(this.deliver(request));
  }

  /** The stubbed "send". Replace this — and only this — to go live. */
  private deliver(request: DeliveryRequest): ProviderResult {
    this.logger.log(`(sms stub) → ${request.to}: ${renderBody(request)}`);
    return {
      ok: true,
      statusCode: 202,
      providerId: `sms_stub_${randomId()}`,
      error: null,
      retryable: false,
    };
  }
}

/** One-line, human-readable body derived from the event that caused the send. */
function renderBody(request: DeliveryRequest): string {
  const body = `Conduit: ${request.type}`;
  return body.length <= MAX_BODY_CHARS ? body : `${body.slice(0, MAX_BODY_CHARS - 1)}…`;
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 12);
}
