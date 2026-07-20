import { describe, expect, it } from 'vitest';
import { SIGNATURE_HEADER } from '@conduit/contracts';
import { fromExpressRequest } from './express';
import { fromFetchRequest } from './fetch';

const RAW = Buffer.from('{"id":"evt_1"}');

describe('fromExpressRequest', () => {
  it('reads a raw Buffer body and the signature header', () => {
    const input = fromExpressRequest({
      body: RAW,
      headers: { [SIGNATURE_HEADER]: 'sig_1' },
    });
    expect(input.rawBody).toBe(RAW);
    expect(input.signature).toBe('sig_1');
  });

  it('accepts the body on req.rawBody instead', () => {
    const input = fromExpressRequest({
      rawBody: RAW,
      body: { parsed: true },
      headers: { [SIGNATURE_HEADER]: 'sig_1' },
    });
    expect(input.rawBody).toBe(RAW);
  });

  it("prefers Express's req.get() for the header", () => {
    const input = fromExpressRequest({
      body: RAW,
      get: (name) => (name === SIGNATURE_HEADER ? 'from_getter' : undefined),
    });
    expect(input.signature).toBe('from_getter');
  });

  it('takes the first value of a repeated header', () => {
    const input = fromExpressRequest({
      body: RAW,
      headers: { [SIGNATURE_HEADER]: ['first', 'second'] },
    });
    expect(input.signature).toBe('first');
  });

  it('returns no signature when the header is absent', () => {
    expect(fromExpressRequest({ body: RAW, headers: {} }).signature).toBeUndefined();
  });

  /**
   * The most likely integration mistake: forgetting `express.raw()`. Re-serialising a parsed
   * body would produce a signature that can never verify, so fail loudly with the fix.
   */
  it('throws a instructive error when the body was already parsed to an object', () => {
    expect(() => fromExpressRequest({ body: { id: 'evt_1' }, headers: {} })).toThrow(
      /express\.raw/,
    );
  });
});

describe('fromFetchRequest', () => {
  function request(body: string, headers: Record<string, string> = {}) {
    // TextEncoder gives a standalone ArrayBuffer. `Buffer.from(s).buffer` would hand back
    // Node's shared allocation pool, which contains far more than these bytes.
    const bytes = new TextEncoder().encode(body);
    return {
      headers: { get: (name: string) => headers[name] ?? null },
      arrayBuffer: () => Promise.resolve(bytes.buffer as ArrayBuffer),
    };
  }

  it('reads the body as bytes and lifts the signature header', async () => {
    const input = await fromFetchRequest(
      request('{"id":"evt_1"}', { [SIGNATURE_HEADER]: 'sig_1' }),
    );
    expect(Buffer.from(input.rawBody).toString()).toBe('{"id":"evt_1"}');
    expect(input.signature).toBe('sig_1');
  });

  it('maps a missing header to undefined, not null', async () => {
    const input = await fromFetchRequest(request('{}'));
    expect(input.signature).toBeUndefined();
  });
});
