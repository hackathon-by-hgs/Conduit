import { SIGNATURE_HEADER } from '@conduit/contracts';
import { verifyPayload } from '../../../common/crypto/signature';
import type { ParsedEvent, SourceScheme } from './source-scheme';

/**
 * Conduit's own scheme, and the fallback for any source without a dedicated one: HMAC-SHA256
 * over the raw bytes in `x-signature`, with a top-level `idempotencyKey` (or `id`).
 *
 * This is what `@conduit/sdk` and the webhook generator sign with.
 */
export const defaultScheme: SourceScheme = {
  signatureHeader: SIGNATURE_HEADER,

  verify(secret, rawBody, signature) {
    return verifyPayload(secret, rawBody, signature);
  },

  parse(body): ParsedEvent {
    return {
      type: typeof body.type === 'string' ? body.type : 'unknown',
      idempotencyKey:
        typeof body.idempotencyKey === 'string'
          ? body.idempotencyKey
          : typeof body.id === 'string'
            ? body.id
            : undefined,
    };
  },
};
