import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { AppConfigService } from '../../../config/config.service';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

export interface ProviderResult {
  ok: boolean;
  statusCode: number;
  providerId: string | null;
  error: string | null;
}

/**
 * Wraps the Resend SDK. Still a stub for the actual network call, but it honours a
 * configurable failure rate (DELIVERY_FAIL_RATE) so retry/backoff/DLQ can be exercised
 * end-to-end without a live provider.
 *
 * TODO(BE2 · P0): perform the real send and capture the true provider response.
 */
@Injectable()
export class ResendProvider {
  private readonly logger = new Logger(ResendProvider.name);
  private readonly client: Resend;

  constructor(private readonly config: AppConfigService) {
    this.client = new Resend(this.config.resendApiKey || 're_stub');
  }

  async send(input: SendEmailInput): Promise<ProviderResult> {
    void this.client; // referenced so the dependency is real once BE2 implements the send
    const failRate = this.config.deliveryFailRate;
    if (failRate > 0 && Math.random() < failRate) {
      return { ok: false, statusCode: 502, providerId: null, error: 'provider_unavailable' };
    }
    this.logger.debug(`(stub) delivered to ${input.to}`);
    return await Promise.resolve({
      ok: true,
      statusCode: 202,
      providerId: `stub_${input.to}`,
      error: null,
    });
  }
}
