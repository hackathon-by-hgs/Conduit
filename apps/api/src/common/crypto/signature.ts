import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Webhook signature scheme (single source of truth, reused by the ingest service and the
 * webhook generator): HMAC-SHA256 over the exact raw body bytes, lowercase hex, carried in
 * the `x-signature` header.
 */

export function signPayload(secret: string, rawBody: Buffer | string): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

export function verifyPayload(
  secret: string,
  rawBody: Buffer | string,
  signature: string,
): boolean {
  const expected = Buffer.from(signPayload(secret, rawBody));
  const provided = Buffer.from(signature);
  // Length check first — timingSafeEqual throws on length mismatch.
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}
