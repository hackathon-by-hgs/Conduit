/** Single source of truth for API paths. Both apps import these — no hand-written strings. */
export const API_ROUTES = {
  webhooks: { ingest: (source: string) => `/webhooks/${source}` },
  events: { list: '/events', detail: (id: string) => `/events/${id}` },
  sends: {
    list: '/sends',
    create: '/sends',
    replay: (id: string) => `/sends/${id}/replay`,
  },
  reconcile: { report: '/reconcile', exportCsv: '/reconcile/export.csv' },
  stats: { get: '/stats' },
  stream: { sse: '/stream' },
  health: { get: '/health' },
} as const;
