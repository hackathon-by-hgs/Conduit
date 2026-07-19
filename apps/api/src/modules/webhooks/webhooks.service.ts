import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { WebhookIngestResponse } from '@conduit/contracts';
import { verifyPayload } from '../../common/crypto/signature';
import { AppConfigService } from '../../config/config.service';
import { WebhooksRepository } from './webhooks.repository';

const MAX_IDEMPOTENCY_KEY_LENGTH = 255;

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly repo: WebhooksRepository,
    private readonly config: AppConfigService,
  ) {}

  async ingest(
    source: string,
    rawBody: Buffer,
    signature?: string,
  ): Promise<WebhookIngestResponse> {
    this.verifySignature(source, rawBody, signature);

    const parsed = this.parse(rawBody);
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
   * Strict per-source HMAC-SHA256 (over the exact raw bytes). Rejects unconfigured
   * sources and bad/missing signatures with 401. Set WEBHOOK_VERIFY=false to bypass
   * locally (mock/FE dev only).
   *
   * TODO(BE1): source-specific signature schemes where a provider differs from plain
   * hex HMAC (e.g. Stripe's `t=...,v1=...`).
   */
  private verifySignature(source: string, rawBody: Buffer, signature?: string): void {
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
        message: 'Missing signature header',
      });
    }
    if (!verifyPayload(secret, rawBody, signature)) {
      throw new UnauthorizedException({
        code: 'INVALID_SIGNATURE',
        message: 'Invalid signature',
      });
    }
  }

  private parse(rawBody: Buffer): {
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
    const type = typeof json.type === 'string' ? json.type : 'unknown';
    const idempotencyKey =
      typeof json.idempotencyKey === 'string'
        ? json.idempotencyKey
        : typeof json.id === 'string'
          ? json.id
          : undefined;
    if (!idempotencyKey) {
      throw new BadRequestException({
        code: 'MISSING_IDEMPOTENCY_KEY',
        message: 'Payload must include an idempotencyKey or id',
      });
    }
    if (idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
      throw new BadRequestException({
        code: 'IDEMPOTENCY_KEY_TOO_LONG',
        message: `idempotencyKey exceeds ${MAX_IDEMPOTENCY_KEY_LENGTH} characters`,
      });
    }
    return { type, idempotencyKey, payload: json };
  }
}
