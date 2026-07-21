import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Conduit's webhook signature scheme, and the single implementation of it: HMAC-SHA256 over
 * the exact raw body bytes, lowercase hex, carried in the `x-signature` header.
 *
 * This lives in the SDK rather than in `@conduit/contracts` because the browser imports
 * contracts, and pulling `node:crypto` into that package would break the web bundle. The API
 * re-exports these from `apps/api/src/common/crypto/signature.ts`, so both ends of the wire
 * are provably running the same code — a signing scheme that drifts between client and
 * server fails silently and looks like an auth bug.
 *
 * Signing MUST use the raw bytes. Re-serialising a parsed body (`JSON.stringify(req.body)`)
 * can reorder keys or change whitespace, and the signature will not match.
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
