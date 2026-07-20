import { describe, expect, it } from 'vitest';
import { signPayload, verifyPayload } from './signature';

const SECRET = 'whsec_test';

describe('signature scheme', () => {
  it('verifies a payload it signed', () => {
    const body = Buffer.from('{"id":"evt_1"}');
    expect(verifyPayload(SECRET, body, signPayload(SECRET, body))).toBe(true);
  });

  it('produces lowercase hex of a fixed length', () => {
    expect(signPayload(SECRET, 'x')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('treats a Buffer and the equivalent string identically', () => {
    const text = '{"id":"evt_1"}';
    expect(signPayload(SECRET, Buffer.from(text))).toBe(signPayload(SECRET, text));
  });

  it('rejects a tampered body', () => {
    const signature = signPayload(SECRET, '{"amount":100}');
    expect(verifyPayload(SECRET, '{"amount":999}', signature)).toBe(false);
  });

  it('rejects the wrong secret', () => {
    const body = '{"id":"evt_1"}';
    expect(verifyPayload('other', body, signPayload(SECRET, body))).toBe(false);
  });

  /** timingSafeEqual throws on length mismatch, so the length guard must come first. */
  it('returns false rather than throwing on a malformed signature', () => {
    const body = '{"id":"evt_1"}';
    for (const bad of ['', 'abc', 'z'.repeat(64), 'a'.repeat(128)]) {
      expect(() => verifyPayload(SECRET, body, bad)).not.toThrow();
      expect(verifyPayload(SECRET, body, bad)).toBe(false);
    }
  });

  /**
   * Byte-exactness is the whole point: re-serialising a parsed body can reorder keys or
   * change whitespace, and the signature will no longer match.
   */
  it('is sensitive to whitespace and key order', () => {
    const signature = signPayload(SECRET, '{"a":1,"b":2}');
    expect(verifyPayload(SECRET, '{"b":2,"a":1}', signature)).toBe(false);
    expect(verifyPayload(SECRET, '{ "a": 1, "b": 2 }', signature)).toBe(false);
  });
});
