import { SIGNATURE_HEADER } from '@conduit/contracts';
import type { HandleInput } from '../types';

/**
 * The shape we need off an Express request. Declared structurally so the SDK does not take
 * a dependency on Express types.
 */
export interface ExpressLikeRequest {
  body?: unknown;
  rawBody?: Buffer | string;
  headers?: Record<string, string | string[] | undefined>;
  get?(name: string): string | undefined;
}

function headerValue(req: ExpressLikeRequest, name: string): string | undefined {
  const viaGetter = req.get?.(name);
  if (typeof viaGetter === 'string') return viaGetter;
  const raw = req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
  return Array.isArray(raw) ? raw[0] : raw;
}

/**
 * Adapt an Express request into the raw bytes + signature `handle()` needs.
 *
 * **Your route must give us the raw body.** Signatures are computed over the exact bytes
 * received, so a body that Express has already parsed and we re-serialise will not match —
 * key order and whitespace are not preserved. Mount the webhook route with:
 *
 * ```js
 * app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), handler);
 * ```
 *
 * With `express.raw()` the bytes arrive as `req.body` (a Buffer). Some setups instead stash
 * them on `req.rawBody`; both are accepted. A parsed object body is rejected outright rather
 * than silently re-serialised into a signature that can never verify.
 */
export function fromExpressRequest(req: ExpressLikeRequest): HandleInput {
  const raw = req.rawBody ?? req.body;

  if (!Buffer.isBuffer(raw) && typeof raw !== 'string') {
    throw new TypeError(
      'Conduit: expected a raw request body (Buffer or string) but got a parsed object. ' +
        "Mount the webhook route with express.raw({ type: 'application/json' }) so the exact " +
        'bytes are preserved — signatures cannot be verified against a re-serialised body.',
    );
  }

  return { rawBody: raw, signature: headerValue(req, SIGNATURE_HEADER) };
}
