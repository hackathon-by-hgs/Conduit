import { createHmac, timingSafeEqual } from 'node:crypto';
import { MONNIFY_SIGNATURE_HEADER } from '@conduit/contracts';
import type { ParsedEvent, SourceScheme } from './source-scheme';

/**
 * Monnify's transaction-notification scheme.
 *
 * Monnify computes an **HMAC-SHA512** of the raw request body keyed by the merchant's client
 * secret, hex-encodes it, and sends it in the `monnify-signature` header — not Conduit's
 * generic SHA-256 `x-signature`. Verifying with the wrong algorithm rejects every legitimate
 * notification, so `monnify` gets its own scheme rather than the shared default.
 *
 * The idempotency key is the provider's own unique reference for the event. Which field that
 * is depends on the event type (a transaction, a settlement and a disbursement each name it
 * differently), hence the ordered candidate list.
 */

/**
 * Per-event-type unique reference, most specific first. Monnify guarantees uniqueness on
 * these, which is exactly what the `@@unique([source, idempotencyKey])` constraint needs.
 */
const REFERENCE_FIELDS = [
  'transactionReference', // SUCCESSFUL_TRANSACTION
  'settlementReference', // SETTLEMENT
  'refundReference', // REFUND_COMPLETED
  'reference', // *_DISBURSEMENT
  'paymentReference', // merchant-supplied fallback
] as const;

export const monnifyScheme: SourceScheme = {
  signatureHeader: MONNIFY_SIGNATURE_HEADER,

  verify(secret, rawBody, signature) {
    const expected = createHmac('sha512', secret).update(rawBody).digest('hex');
    // Monnify's digest is hex, but case is not worth trusting across environments; compare
    // normalised. Length check first — timingSafeEqual throws on a length mismatch.
    const a = Buffer.from(expected);
    const b = Buffer.from(signature.trim().toLowerCase());
    return a.length === b.length && timingSafeEqual(a, b);
  },

  parse(body): ParsedEvent {
    const eventData =
      typeof body.eventData === 'object' && body.eventData !== null
        ? (body.eventData as Record<string, unknown>)
        : {};

    let idempotencyKey: string | undefined;
    for (const field of REFERENCE_FIELDS) {
      const value = eventData[field];
      if (typeof value === 'string' && value.length > 0) {
        idempotencyKey = value;
        break;
      }
    }

    return {
      type: typeof body.eventType === 'string' ? body.eventType : 'unknown',
      idempotencyKey,
    };
  },
};
