/**
 * Cross-feature deep-link contract. FE2 writes `?highlight=<sendId>` onto an event
 * detail link; FE1's detail view reads the same param to focus the offending send.
 * Keeping the param name in one place stops the two ends from drifting.
 */
export const HIGHLIGHT_PARAM = 'highlight';

/** Append the highlight param to a URL when a send is implicated. */
export function withHighlight(href: string, sendId: string | null): string {
  return sendId ? `${href}?${HIGHLIGHT_PARAM}=${encodeURIComponent(sendId)}` : href;
}
