import { describe, expect, it } from 'vitest';
import { JITTER_RATIO, backoffWithJitter, exponentialCeilingMs } from './backoff';

const BASE = 1000;
const CAP = 60_000;

describe('exponentialCeilingMs', () => {
  it('doubles per attempt', () => {
    expect(exponentialCeilingMs(1, BASE, CAP)).toBe(1000);
    expect(exponentialCeilingMs(2, BASE, CAP)).toBe(2000);
    expect(exponentialCeilingMs(3, BASE, CAP)).toBe(4000);
    expect(exponentialCeilingMs(4, BASE, CAP)).toBe(8000);
  });

  it('never exceeds the cap, even for absurd attempt numbers', () => {
    expect(exponentialCeilingMs(50, BASE, CAP)).toBe(CAP);
    expect(exponentialCeilingMs(1000, BASE, CAP)).toBe(CAP);
  });
});

describe('backoffWithJitter', () => {
  it('stays within [50%, 100%] of the exponential ceiling', () => {
    for (let attemptNo = 1; attemptNo <= 8; attemptNo++) {
      const ceiling = exponentialCeilingMs(attemptNo, BASE, CAP);
      for (const seed of ['a', 'b', 'c', 'event-123', '']) {
        const delay = backoffWithJitter(attemptNo, BASE, CAP, seed);
        expect(delay).toBeGreaterThanOrEqual(Math.floor(ceiling * (1 - JITTER_RATIO)));
        expect(delay).toBeLessThanOrEqual(ceiling);
      }
    }
  });

  /**
   * The whole reason jitter is deterministic: the queue's backoff strategy and the
   * `Attempt.nextRetryAt` written by the worker must derive the SAME number, or the
   * delivery timeline the dashboard renders is fiction.
   */
  it('is deterministic for the same (seed, attempt)', () => {
    expect(backoffWithJitter(3, BASE, CAP, 'evt_1')).toBe(backoffWithJitter(3, BASE, CAP, 'evt_1'));
  });

  it('decorrelates different sends so retries do not stampede in lockstep', () => {
    const seeds = Array.from({ length: 50 }, (_, i) => `evt_${i}`);
    const delays = new Set(seeds.map((s) => backoffWithJitter(3, BASE, CAP, s)));
    // Distinct sends failing at the same instant must not all retry at the same instant.
    expect(delays.size).toBeGreaterThan(25);
  });

  it('still grows across attempts despite jitter', () => {
    // Equal jitter keeps the curve monotonic: the floor of attempt N+1 is at or above the
    // ceiling of attempt N, so a later retry can never be scheduled sooner than an earlier one.
    for (let attemptNo = 1; attemptNo <= 5; attemptNo++) {
      const earlier = backoffWithJitter(attemptNo, BASE, CAP, 'evt');
      const later = backoffWithJitter(attemptNo + 1, BASE, CAP, 'evt');
      expect(later).toBeGreaterThanOrEqual(earlier);
    }
  });
});
