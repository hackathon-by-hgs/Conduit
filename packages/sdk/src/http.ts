import type { ApiError } from '@conduit/contracts';
import { ConduitError, ConduitTransportError } from './errors';

/** Injectable so tests can pass a stub and callers can bring their own instrumented fetch. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface HttpOptions {
  baseUrl: string;
  fetch: FetchLike;
  timeoutMs: number;
}

export interface RequestOptions {
  method?: 'GET' | 'POST';
  /** Serialised as JSON. Mutually exclusive with `rawBody`. */
  body?: unknown;
  /** Sent verbatim — used for webhook forwarding, where the exact bytes are what is signed. */
  rawBody?: Buffer | string;
  headers?: Record<string, string>;
  query?: Record<string, string | number | undefined>;
}

/** Drops undefined values so optional filters don't become the string "undefined". */
function buildUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, string | number | undefined>,
): string {
  const url = `${baseUrl.replace(/\/+$/, '')}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

/**
 * Thin HTTP layer: JSON in, JSON out, with a client-side timeout and the API's `ApiError`
 * envelope surfaced as a typed `ConduitError`.
 */
export class Http {
  constructor(private readonly options: HttpOptions) {}

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = buildUrl(this.options.baseUrl, path, options.query);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs);

    let response: Response;
    try {
      response = await this.options.fetch(url, {
        method: options.method ?? 'GET',
        headers: {
          ...(options.rawBody !== undefined || options.body !== undefined
            ? { 'content-type': 'application/json' }
            : {}),
          ...options.headers,
        },
        ...(options.rawBody !== undefined
          ? // A Buffer is a valid fetch body; typed via the indexed type so the SDK does not
            // depend on DOM lib being present.
            { body: options.rawBody as unknown as RequestInit['body'] }
          : options.body !== undefined
            ? { body: JSON.stringify(options.body) }
            : {}),
        signal: controller.signal,
      });
    } catch (cause) {
      const aborted = cause instanceof Error && cause.name === 'AbortError';
      throw new ConduitTransportError(
        aborted
          ? `Request to ${url} timed out after ${this.options.timeoutMs}ms`
          : `Request to ${url} failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        { cause },
      );
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new ConduitError(await this.readError(response, url));
    }

    // 204 and empty bodies are valid responses for some routes.
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  /** Prefer the server's envelope; fall back to a synthetic one for non-JSON errors. */
  private async readError(response: Response, url: string): Promise<ApiError> {
    const fallback: ApiError = {
      statusCode: response.status,
      code: 'HTTP_ERROR',
      message: `${response.status} ${response.statusText}`,
      timestamp: new Date().toISOString(),
      path: url,
    };
    try {
      const body = (await response.json()) as Partial<ApiError>;
      return typeof body?.code === 'string' ? { ...fallback, ...body } : fallback;
    } catch {
      return fallback;
    }
  }
}
