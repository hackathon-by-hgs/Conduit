import { describe, expect, it } from 'vitest';
import { signPayload, verifyPayload } from './signature';

describe('signature helpers', () => {
  const secret = 'whsec_test';
  const body = JSON.stringify({ idempotencyKey: 'k1', type: 'charge.succeeded' });

  it('signs deterministically as 64-char lowercase hex', () => {
    const sig = signPayload(secret, body);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
    expect(signPayload(secret, body)).toBe(sig);
  });

  it('verifies a matching signature', () => {
    expect(verifyPayload(secret, body, signPayload(secret, body))).toBe(true);
  });

  it('rejects a tampered body', () => {
    expect(verifyPayload(secret, `${body} `, signPayload(secret, body))).toBe(false);
  });

  it('rejects a wrong secret', () => {
    expect(verifyPayload('other-secret', body, signPayload(secret, body))).toBe(false);
  });

  it('rejects a malformed signature without throwing', () => {
    expect(verifyPayload(secret, body, 'not-a-valid-hex-signature')).toBe(false);
  });
});
