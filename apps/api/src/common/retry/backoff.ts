import { createHash } from 'node:crypto';

/**
 * Retry backoff: exponential growth, capped, with jitter.
 *
 * Jitter is DETERMINISTIC — derived from a hash of (seed, attemptNo) rather than
 * `Math.random()`. That buys the property that matters (two sends failing at the same
 * instant get different delays, so retries don't stampede the provider in lockstep) while
 * keeping the value reproducible. Reproducibility is what lets the BullMQ backoff strategy
 * and the `Attempt.nextRetryAt` we persist agree on the SAME number, so the delivery
 * timeline the dashboard renders is the real schedule and not an estimate of it.
 *
 * Delay lands in [50%, 100%] of the exponential ceiling ("equal jitter"), which keeps the
 * growth curve intact — unlike full jitter, a late attempt can never collapse back to ~0.
 */

/** Fraction of the ceiling that jitter may shave off. 0.5 → delay ∈ [50%, 100%]. */
export const JITTER_RATIO = 0.5;

/** Uncapped-then-capped exponential ceiling for `attemptNo` (1-based). */
export function exponentialCeilingMs(attemptNo: number, baseMs: number, capMs: number): number {
  const exponent = Math.max(0, attemptNo - 1);
  // Guard the shift: 2 ** big is Infinity, and Math.min(Infinity, cap) is still cap.
  const raw = baseMs * 2 ** Math.min(exponent, 32);
  return Math.min(raw, capMs);
}

/** Stable [0, 1) drawn from a seed string. */
function unitFromSeed(seed: string): number {
  const digest = createHash('sha256').update(seed).digest();
  return digest.readUInt32BE(0) / 2 ** 32;
}

/**
 * Delay before `attemptNo` (1-based: the delay AFTER attempt N fails, before attempt N+1).
 * `seed` should identify the send — the event id is used, since it is available both in
 * the worker and in the queue's backoff strategy.
 */
export function backoffWithJitter(
  attemptNo: number,
  baseMs: number,
  capMs: number,
  seed: string,
): number {
  const ceiling = exponentialCeilingMs(attemptNo, baseMs, capMs);
  const floor = ceiling * (1 - JITTER_RATIO);
  return Math.round(floor + (ceiling - floor) * unitFromSeed(`${seed}:${attemptNo}`));
}
