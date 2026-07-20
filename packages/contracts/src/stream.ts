/**
 * SSE contract (GET /stream). Deliberately dumb: broadcast "something changed,"
 * the client maps each kind to a TanStack Query invalidation and refetches.
 */
export type StreamEvent =
  | { kind: 'event.created'; eventId: string }
  | { kind: 'event.updated'; eventId: string }
  | { kind: 'send.updated'; sendId: string; causedBy: string }
  /**
   * The reconciler's gap set changed (gaps opened and/or resolved). `gapId` is null when a
   * whole pass changed several gaps at once — which is the normal case, since the
   * reconciler works on sets. Treat it as "refetch /reconcile", not as one specific gap.
   */
  | { kind: 'gap.detected'; gapId: string | null }
  | { kind: 'heartbeat'; at: string };

/** Heartbeat cadence — keeps Render/Vercel proxies from closing the connection. */
export const STREAM_HEARTBEAT_MS = 15_000;
