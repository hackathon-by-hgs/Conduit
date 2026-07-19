import { createHash } from 'node:crypto';

/** Stable delivery-dedup key: same recipient + channel + content → same key. */
export function dedupeKeyFor(to: string, channel: string, payload: unknown): string {
  const content = JSON.stringify(payload ?? null);
  return createHash('sha256').update(`${channel}|${to}|${content}`).digest('hex');
}
