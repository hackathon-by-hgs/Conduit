import { describe, expect, it, vi } from 'vitest';
import { SIGNATURE_HEADER } from '@conduit/contracts';
import { Conduit } from './client';
import { ConduitError, ConduitSignatureError, ConduitTransportError } from './errors';
import { signPayload } from './signature';
import type { FetchLike } from './http';

const BASE_URL = 'http://conduit.test';
const SECRET = 'whsec_test';

/** Records every call and replies with whatever the test queued. */
function stubFetch(reply: { status?: number; body?: unknown; text?: string } = {}) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetch: FetchLike = (url, init) => {
    calls.push({ url, init });
    const status = reply.status ?? 200;
    const body = reply.text ?? JSON.stringify(reply.body ?? {});
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      statusText: 'STUB',
      text: () => Promise.resolve(body),
      json: () => Promise.resolve(JSON.parse(body) as unknown),
    } as Response);
  };
  return { fetch, calls };
}

function client(fetch: FetchLike) {
  return new Conduit({ baseUrl: BASE_URL, fetch });
}

describe('handle()', () => {
  const rawBody = Buffer.from(JSON.stringify({ id: 'evt_1', type: 'invoice.paid' }));

  it('forwards a correctly signed webhook and returns the ingest result', async () => {
    const { fetch, calls } = stubFetch({ body: { id: 'stored_1', duplicate: false } });
    const signature = signPayload(SECRET, rawBody);

    const result = await client(fetch).handle(
      { rawBody, signature },
      { source: 'stripe', secret: SECRET },
    );

    expect(result).toEqual({ id: 'stored_1', duplicate: false });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(`${BASE_URL}/webhooks/stripe`);
    expect(calls[0]?.init?.method).toBe('POST');
    // The exact bytes must go over the wire — re-serialising would break the signature.
    expect(calls[0]?.init?.body).toBe(rawBody);
    expect(
      (calls[0]?.init?.headers as Record<string, string> | undefined)?.[SIGNATURE_HEADER],
    ).toBe(signature);
  });

  /** The security-critical case: a forged payload must never reach the event log. */
  it('rejects a bad signature WITHOUT making any network call', async () => {
    const { fetch, calls } = stubFetch();
    const conduit = client(fetch);

    await expect(
      conduit.handle(
        { rawBody, signature: 'deadbeef' },
        { source: 'stripe', secret: SECRET },
      ),
    ).rejects.toBeInstanceOf(ConduitSignatureError);

    expect(calls).toHaveLength(0);
  });

  it('rejects a missing signature, also without a network call', async () => {
    const { fetch, calls } = stubFetch();

    await expect(
      client(fetch).handle({ rawBody }, { source: 'stripe', secret: SECRET }),
    ).rejects.toThrow(/missing/i);
    expect(calls).toHaveLength(0);
  });

  it('rejects a signature made with a different secret', async () => {
    const { fetch, calls } = stubFetch();
    const signature = signPayload('some_other_secret', rawBody);

    await expect(
      client(fetch).handle({ rawBody, signature }, { source: 'stripe', secret: SECRET }),
    ).rejects.toBeInstanceOf(ConduitSignatureError);
    expect(calls).toHaveLength(0);
  });

  it('signs the payload itself when verification is skipped', async () => {
    const { fetch, calls } = stubFetch({ body: { id: 'stored_1', duplicate: false } });

    await client(fetch).handle(
      { rawBody },
      { source: 'stripe', secret: SECRET, skipVerify: true },
    );

    expect(
      (calls[0]?.init?.headers as Record<string, string> | undefined)?.[SIGNATURE_HEADER],
    ).toBe(signPayload(SECRET, rawBody));
  });

  it('reports a duplicate re-delivery rather than failing', async () => {
    const { fetch } = stubFetch({ body: { id: 'stored_1', duplicate: true } });
    const signature = signPayload(SECRET, rawBody);

    const result = await client(fetch).handle(
      { rawBody, signature },
      { source: 'stripe', secret: SECRET },
    );
    expect(result.duplicate).toBe(true);
  });
});

describe('send()', () => {
  it("maps the spec's `type` onto the API's `channel`", async () => {
    const { fetch, calls } = stubFetch({ body: { id: 'snd_1' } });

    await client(fetch).send({ type: 'email', to: 'a@b.com', causedBy: 'evt_1' });

    expect(calls[0]?.url).toBe(`${BASE_URL}/sends`);
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      channel: 'email',
      to: 'a@b.com',
      causedBy: 'evt_1',
    });
  });

  it('passes template, data and an explicit idempotency key through', async () => {
    const { fetch, calls } = stubFetch({ body: { id: 'snd_1' } });

    await client(fetch).send({
      type: 'sms',
      to: '+15551234567',
      causedBy: 'evt_1',
      template: 'receipt',
      data: { amount: 4200 },
      idempotencyKey: 'key_1',
    });

    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      channel: 'sms',
      to: '+15551234567',
      causedBy: 'evt_1',
      template: 'receipt',
      data: { amount: 4200 },
      idempotencyKey: 'key_1',
    });
  });

  it('omits optional fields entirely rather than sending undefined', async () => {
    const { fetch, calls } = stubFetch({ body: { id: 'snd_1' } });

    await client(fetch).send({ type: 'email', to: 'a@b.com', causedBy: 'evt_1' });

    const body = JSON.parse(String(calls[0]?.init?.body)) as Record<string, unknown>;
    expect(Object.keys(body)).not.toContain('template');
    expect(Object.keys(body)).not.toContain('idempotencyKey');
  });
});

describe('reconcile()', () => {
  it("maps the spec's `since` onto the API's `from`", async () => {
    const { fetch, calls } = stubFetch({ body: { gaps: [] } });

    await client(fetch).reconcile({ since: '2026-07-01' });

    expect(calls[0]?.url).toBe(`${BASE_URL}/reconcile?from=2026-07-01`);
  });

  it('supports the open/resolved filter and an upper bound', async () => {
    const { fetch, calls } = stubFetch({ body: { gaps: [] } });

    await client(fetch).reconcile({ since: '2026-07-01', until: '2026-07-31', status: 'open' });

    expect(calls[0]?.url).toContain('from=2026-07-01');
    expect(calls[0]?.url).toContain('to=2026-07-31');
    expect(calls[0]?.url).toContain('status=open');
  });

  it('sends no query string at all when unfiltered', async () => {
    const { fetch, calls } = stubFetch({ body: { gaps: [] } });

    await client(fetch).reconcile();

    expect(calls[0]?.url).toBe(`${BASE_URL}/reconcile`);
  });
});

describe('read helpers', () => {
  it('hits the documented routes', async () => {
    const { fetch, calls } = stubFetch({ body: {} });
    const conduit = client(fetch);

    await conduit.events.list({ status: 'processed' });
    await conduit.events.get('evt_1');
    await conduit.sends.list({ status: 'dead_lettered' });
    await conduit.sends.replay('snd_1');
    await conduit.stats();

    expect(calls.map((c) => c.url)).toEqual([
      `${BASE_URL}/events?status=processed`,
      `${BASE_URL}/events/evt_1`,
      `${BASE_URL}/sends?status=dead_lettered`,
      `${BASE_URL}/sends/snd_1/replay`,
      `${BASE_URL}/stats`,
    ]);
    expect(calls[3]?.init?.method).toBe('POST');
  });
});

describe('errors', () => {
  it("surfaces the API's error envelope as a typed ConduitError", async () => {
    const { fetch } = stubFetch({
      status: 404,
      body: {
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Event evt_missing not found',
        timestamp: '2026-07-20T00:00:00.000Z',
        path: '/sends',
      },
    });

    const error = await client(fetch)
      .send({ type: 'email', to: 'a@b.com', causedBy: 'evt_missing' })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConduitError);
    expect((error as ConduitError).code).toBe('NOT_FOUND');
    expect((error as ConduitError).statusCode).toBe(404);
    expect((error as ConduitError).retryable).toBe(false);
  });

  it('marks 5xx and 429 as retryable', async () => {
    for (const status of [500, 502, 429]) {
      const { fetch } = stubFetch({ status, text: 'upstream exploded' });
      const error = (await client(fetch)
        .stats()
        .catch((e: unknown) => e)) as ConduitError;
      expect(error.retryable).toBe(true);
    }
  });

  it('falls back to a synthetic envelope when the body is not JSON', async () => {
    const { fetch } = stubFetch({ status: 502, text: '<html>bad gateway</html>' });

    const error = (await client(fetch)
      .stats()
      .catch((e: unknown) => e)) as ConduitError;

    expect(error).toBeInstanceOf(ConduitError);
    expect(error.code).toBe('HTTP_ERROR');
    expect(error.statusCode).toBe(502);
  });

  it('wraps a network failure as a transport error', async () => {
    const fetch: FetchLike = () => Promise.reject(new Error('ECONNREFUSED'));

    await expect(client(fetch).stats()).rejects.toBeInstanceOf(ConduitTransportError);
  });

  it('times out rather than hanging forever', async () => {
    const fetch: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });

    const conduit = new Conduit({ baseUrl: BASE_URL, fetch, timeoutMs: 10 });
    await expect(conduit.stats()).rejects.toThrow(/timed out after 10ms/);
  });
});

describe('authentication', () => {
  it('sends the API key as a Bearer token on every request', async () => {
    const { fetch, calls } = stubFetch({ body: {} });
    const conduit = new Conduit({ baseUrl: BASE_URL, fetch, apiKey: 'sk_test_123' });

    await conduit.stats();
    await conduit.sends.replay('snd_1');

    for (const call of calls) {
      expect((call.init?.headers as Record<string, string>).authorization).toBe(
        'Bearer sk_test_123',
      );
    }
  });

  it('sends no Authorization header when no key is configured', async () => {
    const { fetch, calls } = stubFetch({ body: {} });

    await client(fetch).stats();

    expect((calls[0]?.init?.headers as Record<string, string>).authorization).toBeUndefined();
  });

  it('authenticates forwarded webhooks too, without disturbing the signature header', async () => {
    const { fetch, calls } = stubFetch({ body: { id: 'e1', duplicate: false } });
    const rawBody = Buffer.from('{"id":"evt_1"}');
    const conduit = new Conduit({ baseUrl: BASE_URL, fetch, apiKey: 'sk_test_123' });

    await conduit.handle(
      { rawBody, signature: signPayload(SECRET, rawBody) },
      { source: 'stripe', secret: SECRET },
    );

    const headers = calls[0]?.init?.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer sk_test_123');
    expect(headers[SIGNATURE_HEADER]).toBe(signPayload(SECRET, rawBody));
  });

  it('surfaces a 401 from the service as a non-retryable ConduitError', async () => {
    const { fetch } = stubFetch({
      status: 401,
      body: {
        statusCode: 401,
        code: 'UNAUTHORIZED',
        message: 'Invalid API key.',
        timestamp: '2026-07-20T00:00:00.000Z',
        path: '/stats',
      },
    });

    const error = (await client(fetch)
      .stats()
      .catch((e: unknown) => e)) as ConduitError;

    expect(error).toBeInstanceOf(ConduitError);
    expect(error.code).toBe('UNAUTHORIZED');
    // Retrying with the same bad key would just fail again.
    expect(error.retryable).toBe(false);
  });
});

describe('construction', () => {
  it('trims a trailing slash off the base URL', async () => {
    const { fetch, calls } = stubFetch({ body: {} });
    await new Conduit({ baseUrl: `${BASE_URL}/`, fetch }).stats();
    expect(calls[0]?.url).toBe(`${BASE_URL}/stats`);
  });

  it('fails loudly when no fetch is available', () => {
    const original = globalThis.fetch;
    // @ts-expect-error — simulating an old runtime with no global fetch.
    delete globalThis.fetch;
    try {
      expect(() => new Conduit({ baseUrl: BASE_URL })).toThrow(/no fetch implementation/i);
    } finally {
      globalThis.fetch = original;
    }
  });

  it('uses the global fetch when none is supplied', async () => {
    const spy = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () => Promise.resolve('{}'),
        json: () => Promise.resolve({}),
      } as Response),
    );
    const original = globalThis.fetch;
    globalThis.fetch = spy as unknown as typeof globalThis.fetch;
    try {
      await new Conduit({ baseUrl: BASE_URL }).stats();
      expect(spy).toHaveBeenCalledOnce();
    } finally {
      globalThis.fetch = original;
    }
  });
});
