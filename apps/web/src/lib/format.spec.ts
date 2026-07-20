import { describe, expect, it } from 'vitest';
import { age } from './format';

const now = Date.parse('2026-07-19T12:00:00.000Z');
const ago = (ms: number) => new Date(now - ms).toISOString();

describe('age', () => {
  it('reports seconds under a minute', () => {
    expect(age(ago(30_000), now)).toBe('30s');
  });

  it('reports minutes under an hour', () => {
    expect(age(ago(5 * 60_000), now)).toBe('5m');
  });

  it('reports hours under a day', () => {
    expect(age(ago(2 * 3_600_000), now)).toBe('2h');
  });

  it('reports days beyond that', () => {
    expect(age(ago(3 * 86_400_000), now)).toBe('3d');
  });

  it('clamps future timestamps to zero', () => {
    expect(age(ago(-5_000), now)).toBe('0s');
  });
});
