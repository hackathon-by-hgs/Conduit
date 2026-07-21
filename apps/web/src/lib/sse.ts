'use client';

import { useEffect } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { API_ROUTES, type StreamEvent } from '@conduit/contracts';
import { API_PROXY_BASE } from './api-client';
import { queryKeys } from './query-keys';
import { isMockMode } from '@/mocks';
import { useStreamStore } from '@/stores/stream.store';

/** Polling cadence used when SSE cannot hold a connection. */
export const STREAM_POLL_MS = 3000;
/** Grace period after a disconnect before falling back to polling. */
export const STREAM_FALLBACK_DELAY_MS = 4000;

/**
 * Apply the invalidations a stream event implies. With no event (a polling tick)
 * everything the stream would have driven is refreshed.
 */
function invalidateLive(qc: QueryClient, ev?: StreamEvent): void {
  // Stats reflect every change either way.
  void qc.invalidateQueries({ queryKey: queryKeys.stats.current() });

  if (!ev) {
    void qc.invalidateQueries({ queryKey: queryKeys.events.all });
    void qc.invalidateQueries({ queryKey: queryKeys.sends.all });
    void qc.invalidateQueries({ queryKey: queryKeys.reconcile.all });
    return;
  }

  switch (ev.kind) {
    case 'event.created':
    case 'event.updated':
      void qc.invalidateQueries({ queryKey: queryKeys.events.all });
      break;
    case 'send.updated':
      void qc.invalidateQueries({ queryKey: queryKeys.sends.all });
      void qc.invalidateQueries({ queryKey: queryKeys.events.detail(ev.causedBy) });
      break;
    case 'gap.detected':
      void qc.invalidateQueries({ queryKey: queryKeys.reconcile.all });
      break;
    case 'heartbeat':
      break;
  }
}

/**
 * Bridge the SSE stream to TanStack Query invalidation, with a polling fallback.
 *
 * On a healthy connection each event maps to a targeted invalidation. If the
 * connection drops and cannot be re-established within a short grace period, the
 * hook polls every STREAM_POLL_MS so the views keep updating; polling stops
 * automatically once the stream reconnects. Disabled entirely in mock mode.
 */
export function useConduitStream(): void {
  const qc = useQueryClient();
  const setStatus = useStreamStore((s) => s.setStatus);

  useEffect(() => {
    if (isMockMode()) {
      setStatus('disabled');
      return;
    }

    let poll: ReturnType<typeof setInterval> | null = null;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    const stopPolling = () => {
      if (poll) {
        clearInterval(poll);
        poll = null;
      }
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
    };

    const startPolling = () => {
      if (poll) return;
      setStatus('polling');
      poll = setInterval(() => invalidateLive(qc), STREAM_POLL_MS);
    };

    // Through the same-origin proxy, which attaches the API key server-side. EventSource
    // cannot set request headers at all, so going direct would be impossible once the
    // service requires a key.
    const es = new EventSource(`${API_PROXY_BASE}${API_ROUTES.stream.sse}`);

    es.onopen = () => {
      stopPolling();
      setStatus('connected');
    };

    es.onerror = () => {
      // EventSource auto-retries; give it a grace period before we start polling.
      if (poll) return;
      setStatus('reconnecting');
      if (!fallbackTimer) {
        fallbackTimer = setTimeout(startPolling, STREAM_FALLBACK_DELAY_MS);
      }
    };

    es.onmessage = (m) => {
      const ev = JSON.parse(m.data) as StreamEvent;
      invalidateLive(qc, ev);
    };

    return () => {
      stopPolling();
      es.close();
    };
  }, [qc, setStatus]);
}
