import { NextRequest } from 'next/server';
import { AUTH_HEADER, bearer } from '@conduit/contracts';

/**
 * Server-side proxy to the Conduit API.
 *
 * The dashboard runs in the browser, so it cannot hold the service key — anything in a
 * `NEXT_PUBLIC_*` variable is readable from devtools. Instead the browser calls this
 * same-origin route and the key is attached here, on the server, where it stays.
 *
 * `CONDUIT_API_KEY` is deliberately NOT prefixed with `NEXT_PUBLIC_`, so Next refuses to
 * inline it into client bundles.
 *
 * Note this proxy inherits the dashboard's own access control, of which there is currently
 * none: anyone who can load the dashboard can use it. It protects the KEY, not the data.
 * A real deployment needs a user session in front of this.
 */

/**
 * `CONDUIT_API_URL` is read at RUNTIME. `NEXT_PUBLIC_*` values are inlined into the bundle at
 * BUILD time, so a deploy that only sets them at runtime silently proxies to localhost and
 * every request 502s. The public var stays as a fallback for existing local `.env` files.
 */
const DEFAULT_CONDUIT_API_URL = 'https://conduit-735w.onrender.com';

function apiUrl(): string {
  const url =
    process.env.CONDUIT_API_URL || process.env.NEXT_PUBLIC_API_URL || DEFAULT_CONDUIT_API_URL;
  return url.replace(/\/+$/, '');
}

/** Hop-by-hop and body-shaping headers must not be forwarded verbatim. */
const STRIPPED_REQUEST_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
  'accept-encoding',
  AUTH_HEADER, // never let a caller smuggle their own credentials through
]);

const STRIPPED_RESPONSE_HEADERS = new Set([
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
]);

async function proxy(request: NextRequest, path: string[]): Promise<Response> {
  const target = `${apiUrl()}/${path.join('/')}${request.nextUrl.search}`;
  const apiKey = process.env.CONDUIT_API_KEY ?? '';

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!STRIPPED_REQUEST_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });
  if (apiKey) headers.set(AUTH_HEADER, bearer(apiKey));

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      ...(hasBody ? { body: await request.arrayBuffer() } : {}),
      // Never cache: this is a live event log, and SSE must stream.
      cache: 'no-store',
      redirect: 'manual',
    });
  } catch {
    return Response.json(
      {
        statusCode: 502,
        code: 'UPSTREAM_UNREACHABLE',
        message: 'Could not reach the Conduit API.',
        timestamp: new Date().toISOString(),
        path: `/${path.join('/')}`,
      },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!STRIPPED_RESPONSE_HEADERS.has(key.toLowerCase())) responseHeaders.set(key, value);
  });
  // Stop any intermediary from buffering the SSE stream into oblivion.
  responseHeaders.set('cache-control', 'no-cache, no-transform');

  // Passing the body through as a stream keeps `GET /stream` (SSE) working: events reach the
  // browser as they are produced rather than when the response ends — which, for a stream
  // that never ends, would be never.
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

type Context = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, ctx: Context): Promise<Response> {
  return proxy(request, (await ctx.params).path);
}

export async function POST(request: NextRequest, ctx: Context): Promise<Response> {
  return proxy(request, (await ctx.params).path);
}

/** SSE must not be statically optimised or cached. */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
