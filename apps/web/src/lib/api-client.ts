import type { ApiError } from '@conduit/contracts';
import { isMockMode, mockResolve } from '@/mocks';

// Normalize so a trailing slash on NEXT_PUBLIC_API_URL can't produce `//path`.
const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/+$/, '');
const REQUEST_TIMEOUT_MS = 15_000;

export class ApiClientError extends Error {
  constructor(public readonly error: ApiError) {
    super(error.message);
    this.name = 'ApiClientError';
  }
}

function envelope(path: string, statusCode: number, code: string, message: string): ApiError {
  return { statusCode, code, message, timestamp: new Date().toISOString(), path };
}

/** Fetch with a timeout; network/timeout and non-2xx are raised as ApiClientError. */
async function doFetch(path: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch (err) {
    // Timeout or network failure: surface as the shared envelope (statusCode 0) so views
    // render a consistent error state and the retry policy treats it as transient.
    const aborted = err instanceof DOMException && err.name === 'AbortError';
    throw new ApiClientError(
      envelope(
        path,
        0,
        aborted ? 'TIMEOUT' : 'NETWORK_ERROR',
        aborted ? 'The request timed out.' : 'Could not reach the API.',
      ),
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const parsed = (await res.json().catch(() => null)) as ApiError | null;
    throw new ApiClientError(
      parsed ?? envelope(path, res.status, 'UNKNOWN', res.statusText || 'Request failed'),
    );
  }
  return res;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Mock adapter — every view works before the API lands (env-var flip to go live).
  if (isMockMode()) {
    return mockResolve<T>(path, init);
  }
  const res = await doFetch(path, init);
  // Tolerate empty bodies (e.g. a 204) without throwing on JSON parse.
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(p: string) => request<T>(p),
  post: <T>(p: string, body?: unknown) =>
    request<T>(p, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  /** Fetch a non-JSON (text) body, e.g. a CSV export. Live-only; callers handle mock mode. */
  getText: async (p: string): Promise<string> => (await doFetch(p)).text(),
};
