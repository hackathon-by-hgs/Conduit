import { createHmac } from 'node:crypto';
import { MONNIFY_SIGNATURE_HEADER, SIGNATURE_HEADER } from '@conduit/contracts';
import { describe, expect, it } from 'vitest';
import { signPayload } from '../../../common/crypto/signature';
import { defaultScheme, monnifyScheme, schemeFor } from './index';

const MONNIFY_SECRET = 'MK_TEST_CLIENT_SECRET';

/** What Monnify actually posts: SHA-512 hex of the raw body, keyed by the client secret. */
function monnifySign(secret: string, rawBody: string): string {
  return createHmac('sha512', secret).update(rawBody).digest('hex');
}

const MONNIFY_BODY = JSON.stringify({
  eventType: 'SUCCESSFUL_TRANSACTION',
  eventData: {
    transactionReference: 'MNFY|20260719|0001',
    paymentReference: 'order_4821',
    amountPaid: '4200.00',
    customer: { email: 'ada@example.com' },
  },
});

describe('schemeFor', () => {
  it('routes monnify to its own scheme, case-insensitively', () => {
    expect(schemeFor('monnify')).toBe(monnifyScheme);
    expect(schemeFor('MONNIFY')).toBe(monnifyScheme);
  });

  it('falls back to the generic scheme for every other source', () => {
    expect(schemeFor('stripe')).toBe(defaultScheme);
    expect(schemeFor('github')).toBe(defaultScheme);
  });
});

describe('monnify scheme', () => {
  it('reads its signature from the monnify-signature header', () => {
    expect(monnifyScheme.signatureHeader).toBe(MONNIFY_SIGNATURE_HEADER);
  });

  it('verifies a genuine SHA-512 signature over the raw body', () => {
    const signature = monnifySign(MONNIFY_SECRET, MONNIFY_BODY);
    expect(monnifyScheme.verify(MONNIFY_SECRET, Buffer.from(MONNIFY_BODY), signature)).toBe(true);
  });

  it('accepts an uppercase digest', () => {
    const signature = monnifySign(MONNIFY_SECRET, MONNIFY_BODY).toUpperCase();
    expect(monnifyScheme.verify(MONNIFY_SECRET, Buffer.from(MONNIFY_BODY), signature)).toBe(true);
  });

  it('rejects a SHA-256 digest of the same body — the algorithm is the point', () => {
    const wrongAlgorithm = signPayload(MONNIFY_SECRET, MONNIFY_BODY);
    expect(monnifyScheme.verify(MONNIFY_SECRET, Buffer.from(MONNIFY_BODY), wrongAlgorithm)).toBe(
      false,
    );
  });

  it('rejects a tampered body and a wrong secret', () => {
    const signature = monnifySign(MONNIFY_SECRET, MONNIFY_BODY);
    expect(monnifyScheme.verify(MONNIFY_SECRET, Buffer.from(`${MONNIFY_BODY} `), signature)).toBe(
      false,
    );
    expect(monnifyScheme.verify('MK_TEST_OTHER', Buffer.from(MONNIFY_BODY), signature)).toBe(false);
  });

  it('rejects a malformed signature without throwing', () => {
    expect(monnifyScheme.verify(MONNIFY_SECRET, Buffer.from(MONNIFY_BODY), 'nope')).toBe(false);
  });

  it('maps eventType → type and transactionReference → idempotency key', () => {
    expect(monnifyScheme.parse(JSON.parse(MONNIFY_BODY))).toEqual({
      type: 'SUCCESSFUL_TRANSACTION',
      idempotencyKey: 'MNFY|20260719|0001',
    });
  });

  it('uses the reference field the event type actually carries', () => {
    expect(
      monnifyScheme.parse({
        eventType: 'SETTLEMENT',
        eventData: { settlementReference: 'STL|001' },
      }).idempotencyKey,
    ).toBe('STL|001');

    expect(
      monnifyScheme.parse({
        eventType: 'SUCCESSFUL_DISBURSEMENT',
        eventData: { reference: 'DSB|001' },
      }).idempotencyKey,
    ).toBe('DSB|001');
  });

  it('reports no idempotency key when the body carries no reference', () => {
    expect(monnifyScheme.parse({ eventType: 'SETTLEMENT', eventData: {} })).toEqual({
      type: 'SETTLEMENT',
      idempotencyKey: undefined,
    });
    expect(monnifyScheme.parse({}).idempotencyKey).toBeUndefined();
  });
});

describe('default scheme', () => {
  const body = JSON.stringify({ idempotencyKey: 'k1', type: 'charge.succeeded' });

  it('reads its signature from x-signature', () => {
    expect(defaultScheme.signatureHeader).toBe(SIGNATURE_HEADER);
  });

  it('verifies Conduit’s own SHA-256 signature', () => {
    expect(
      defaultScheme.verify('whsec_test', Buffer.from(body), signPayload('whsec_test', body)),
    ).toBe(true);
  });

  it('prefers idempotencyKey, then id', () => {
    expect(defaultScheme.parse(JSON.parse(body)).idempotencyKey).toBe('k1');
    expect(defaultScheme.parse({ id: 'evt_1' }).idempotencyKey).toBe('evt_1');
    expect(defaultScheme.parse({}).idempotencyKey).toBeUndefined();
  });

  it('defaults a missing type to "unknown"', () => {
    expect(defaultScheme.parse({ id: 'evt_1' }).type).toBe('unknown');
  });
});
