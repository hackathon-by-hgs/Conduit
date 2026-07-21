export const MATRIX_ACTIONS = ['Read', 'Create', 'Update', 'Delete', 'Replay', 'Admin'] as const;

export type MatrixAction = (typeof MATRIX_ACTIONS)[number];

export type MatrixRow = {
  id: string;
  label: string;
  actions: Partial<Record<MatrixAction, string>>;
};

export const MATRIX_ROWS: MatrixRow[] = [
  { id: 'events', label: 'Events', actions: { Read: 'events:read', Update: 'events:filter' } },
  { id: 'realtime', label: 'Realtime', actions: { Read: 'events:stream' } },
  { id: 'sends', label: 'Sends', actions: { Read: 'sends:read', Replay: 'sends:replay' } },
  { id: 'dlq', label: 'Dead letter', actions: { Read: 'sends:dlq:read', Replay: 'sends:dlq:replay' } },
  { id: 'reconcile', label: 'Reconcile', actions: { Read: 'reconcile:read', Update: 'gaps:deeplink' } },
  { id: 'analytics', label: 'Analytics', actions: { Read: 'stats:read', Create: 'stats:export' } },
  { id: 'webhooks', label: 'Webhooks', actions: { Create: 'webhooks:ingest', Update: 'webhooks:configure' } },
  { id: 'credentials', label: 'Credentials', actions: { Read: 'keys:read', Update: 'keys:rotate', Admin: 'sdk:manage' } },
];

export const ENDPOINTS = [
  { method: 'GET', path: '/events', scope: 'events:read' },
  { method: 'GET', path: '/stream', scope: 'events:stream' },
  { method: 'POST', path: '/sends/:id/replay', scope: 'sends:replay' },
  { method: 'GET', path: '/reconcile', scope: 'reconcile:read' },
  { method: 'GET', path: '/stats', scope: 'stats:read' },
  { method: 'POST', path: '/webhooks', scope: 'webhooks:ingest' },
  { method: 'POST', path: '/keys/rotate', scope: 'keys:rotate' },
];
