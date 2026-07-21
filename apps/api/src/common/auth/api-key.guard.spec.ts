import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { ApiKeyGuard } from './api-key.guard';
import type { AppConfigService } from '../../config/config.service';

const KEY = 'sk_test_abc123';

function context(headers: Record<string, string | string[]> = {}): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

/** Reflector stub: `isPublic` decides whether the route opted out of the guard. */
function reflector(isPublic = false): Reflector {
  return { getAllAndOverride: () => isPublic } as unknown as Reflector;
}

function guard(apiKey: string, isPublic = false): ApiKeyGuard {
  return new ApiKeyGuard({ apiKey } as AppConfigService, reflector(isPublic));
}

describe('ApiKeyGuard', () => {
  it('accepts a correct Bearer token', () => {
    expect(guard(KEY).canActivate(context({ authorization: `Bearer ${KEY}` }))).toBe(true);
  });

  it('accepts the x-api-key header as an alternative', () => {
    expect(guard(KEY).canActivate(context({ 'x-api-key': KEY }))).toBe(true);
  });

  it('accepts the scheme case-insensitively, per RFC 7235', () => {
    expect(guard(KEY).canActivate(context({ authorization: `bearer ${KEY}` }))).toBe(true);
    expect(guard(KEY).canActivate(context({ authorization: `BEARER ${KEY}` }))).toBe(true);
  });

  it('rejects a wrong key', () => {
    expect(() => guard(KEY).canActivate(context({ authorization: 'Bearer wrong' }))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a missing key with an instructive message', () => {
    expect(() => guard(KEY).canActivate(context())).toThrow(/missing api key/i);
  });

  it('rejects an empty or malformed Authorization header', () => {
    for (const header of ['', 'Bearer', 'Bearer   ', 'Basic abc', KEY]) {
      expect(() => guard(KEY).canActivate(context({ authorization: header }))).toThrow(
        UnauthorizedException,
      );
    }
  });

  /** A near-miss must not be accepted — the comparison is exact, not a prefix match. */
  it('rejects keys that merely share a prefix or differ in length', () => {
    for (const wrong of [KEY.slice(0, -1), `${KEY}x`, KEY.toUpperCase()]) {
      expect(() => guard(KEY).canActivate(context({ authorization: `Bearer ${wrong}` }))).toThrow(
        UnauthorizedException,
      );
    }
  });

  it('takes the first value of a repeated header', () => {
    expect(guard(KEY).canActivate(context({ authorization: [`Bearer ${KEY}`, 'Bearer x'] }))).toBe(
      true,
    );
  });

  it('lets a @Public() route through without a key', () => {
    expect(guard(KEY, true).canActivate(context())).toBe(true);
  });

  /**
   * No key configured means auth is off — that is what keeps local dev, the seed script and
   * the mock generator frictionless. The guard warns loudly about it at boot.
   */
  it('is disabled entirely when no key is configured', () => {
    expect(guard('').canActivate(context())).toBe(true);
    expect(guard('').canActivate(context({ authorization: 'Bearer anything' }))).toBe(true);
  });

  it('warns at boot when auth is off, and confirms when it is on', () => {
    // onModuleInit only logs; the assertion is that neither path throws.
    expect(() => guard('').onModuleInit()).not.toThrow();
    expect(() => guard(KEY).onModuleInit()).not.toThrow();
  });
});
