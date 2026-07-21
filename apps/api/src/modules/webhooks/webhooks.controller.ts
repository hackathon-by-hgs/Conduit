import { Controller, Param, Post, type RawBodyRequest, Req, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import type { WebhookIngestResponse } from '@conduit/contracts';
import { Public } from '../../common/auth/public.decorator';
import { WebhooksService } from './webhooks.service';

/**
 * Exempt from the API key: providers like Stripe post here directly and cannot send our key.
 * This endpoint is authenticated by its per-source HMAC signature instead, which is a
 * stronger guarantee — it proves the payload is untampered, not just that the caller knows
 * a shared secret.
 */
@Public()
// Rate-limit the ingest endpoint (config: THROTTLE_TTL_MS / THROTTLE_LIMIT). Excess → 429.
@UseGuards(ThrottlerGuard)
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Post(':source')
  ingest(
    @Param('source') source: string,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<WebhookIngestResponse> {
    // rawBody is populated by NestFactory({ rawBody: true }); fall back for safety.
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    // All headers go through: the source's scheme picks the one it signs in, since Monnify
    // uses `monnify-signature` where Conduit's generic scheme uses `x-signature`.
    return this.webhooks.ingest(source, raw, req.headers);
  }
}
