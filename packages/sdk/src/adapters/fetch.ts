import { SIGNATURE_HEADER } from '@conduit/contracts';
import type { HandleInput } from '../types';

/** The subset of the web `Request` we use — structural, so any Fetch-like object works. */
export interface FetchLikeRequest {
  headers: { get(name: string): string | null };
  arrayBuffer(): Promise<ArrayBuffer>;
}

/**
 * Adapt a Fetch `Request` (Next.js route handlers, Hono, Bun, Cloudflare Workers) into the
 * raw bytes + signature `handle()` needs.
 *
 * Reads the body as an ArrayBuffer, so the exact bytes are preserved for signature checking.
 * A request body can only be consumed once — call this before anything else reads it, or
 * pass `request.clone()`.
 */
export async function fromFetchRequest(request: FetchLikeRequest): Promise<HandleInput> {
  const buffer = await request.arrayBuffer();
  return {
    rawBody: Buffer.from(buffer),
    signature: request.headers.get(SIGNATURE_HEADER) ?? undefined,
  };
}
