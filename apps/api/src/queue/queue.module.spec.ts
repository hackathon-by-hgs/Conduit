import { describe, expect, it } from 'vitest';
import { redisConnection } from './queue.module';

/**
 * These only ever fail in production, so they are worth pinning: a local
 * `redis://localhost:6380` exercises none of the auth or TLS handling that a managed
 * instance's URL depends on.
 */
describe('redisConnection', () => {
  it('parses a plain local URL', () => {
    expect(redisConnection('redis://localhost:6380')).toEqual({ host: 'localhost', port: 6380 });
  });

  it('defaults the port when the URL omits it', () => {
    expect(redisConnection('redis://cache.internal').port).toBe(6379);
  });

  it('keeps the username as well as the password', () => {
    expect(redisConnection('redis://default:s3cret@host:6379')).toEqual({
      host: 'host',
      port: 6379,
      username: 'default',
      password: 's3cret',
    });
  });

  it('enables TLS for rediss:// — a managed instance rejects a plaintext connection', () => {
    expect(redisConnection('rediss://default:s3cret@host:6380').tls).toEqual({});
    expect(redisConnection('redis://host:6380').tls).toBeUndefined();
  });

  it('decodes percent-encoded credentials', () => {
    expect(redisConnection('redis://user:p%40ss%2Fword@host:6379').password).toBe('p@ss/word');
  });
});
