import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type { WebhookIngestResponse } from '@conduit/contracts';
import { AppConfigService } from '../../config/config.service';
import { schemeFor, type SourceScheme } from './schemes';
import { WebhooksRepository } from './webhooks.repository';

const MAX_IDEMPOTENCY_KEY_LENGTH = 255;

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly repo: WebhooksRepository,
    private readonly config: AppConfigService,
  ) {}

  /**
   * @param headers the request headers — the source's scheme decides which one carries its
   *   signature (`x-signature` generically, `monnify-signature` for Monnify).
   */
  async ingest(
    source: string,
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<WebhookIngestResponse> {
    const scheme = schemeFor(source);
    const signature = headerValue(headers, scheme.signatureHeader);

    this.verifySignature(source, scheme, rawBody, signature);

    const parsed = this.parse(scheme, rawBody);
    // Atomic: persists the event AND its delivery outbox row in one transaction; the
    // outbox dispatcher hands it to BullMQ. No direct enqueue on the request path
    // (fast-ack, and ingest still succeeds if Redis is down).
    const { event, duplicate } = await this.repo.createIfNew({
      source,
      type: parsed.type,
      idempotencyKey: parsed.idempotencyKey,
      payload: parsed.payload,
      signature: signature ?? null,
    });

    return { id: event.id, duplicate };
  }

  /**
   * Strict per-source HMAC over the exact raw bytes, using the source's own scheme. Rejects
   * unconfigured sources and bad/missing signatures with 401. Set WEBHOOK_VERIFY=false to
   * bypass locally (mock/FE dev only).
   */
  private verifySignature(
    source: string,
    scheme: SourceScheme,
    rawBody: Buffer,
    signature?: string,
  ): void {
    if (!this.config.webhookVerifyEnabled) {
      this.logger.warn(`WEBHOOK_VERIFY is off — skipping signature check for "${source}".`);
      return;
    }

    const secret = this.config.webhookSecret(source);
    if (!secret) {
      throw new UnauthorizedException({
        code: 'UNKNOWN_SOURCE',
        message: `No signing secret configured for source "${source}"`,
      });
    }
    if (!signature) {
      throw new UnauthorizedException({
        code: 'INVALID_SIGNATURE',
        message: `Missing ${scheme.signatureHeader} header`,
      });
    }
    if (!scheme.verify(secret, rawBody, signature)) {
      throw new UnauthorizedException({
        code: 'INVALID_SIGNATURE',
        message: 'Invalid signature',
      });
    }
  }

  private parse(
    scheme: SourceScheme,
    rawBody: Buffer,
  ): {
    type: string;
    idempotencyKey: string;
    payload: Record<string, unknown>;
  } {
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>;
    } catch {
      throw new BadRequestException({
        code: 'INVALID_PAYLOAD',
        message: 'Body is not valid JSON',
      });
    }
    const { type, idempotencyKey } = scheme.parse(json);
    if (!idempotencyKey) {
      throw new BadRequestException({
        code: 'MISSING_IDEMPOTENCY_KEY',
        message: 'Payload has no field usable as an idempotency key',
      });
    }
    if (idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
      throw new BadRequestException({
        code: 'IDEMPOTENCY_KEY_TOO_LONG',
        message: `idempotencyKey exceeds ${MAX_IDEMPOTENCY_KEY_LENGTH} characters`,
      });
    }
    // The FULL raw body is stored, whatever the scheme read out of it — the event log is the
    // audit record, so nothing the provider sent is discarded.
    return { type, idempotencyKey, payload: json };
  }
}

/** Node lowercases header names; an array (a repeated header) takes the first value. */
function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const value = headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}
