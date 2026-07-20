import { EVENT_STATUS, type EventStatus, type SendStatus } from '@conduit/contracts';

/** View-model filter shapes (client/UI intent). Never wire types. */
export interface EventFilters {
  status?: EventStatus;
  source?: string;
  from?: string;
  to?: string;
}

export interface SendFilters {
  status?: SendStatus;
}

export const DEFAULT_EVENT_FILTERS: EventFilters = {};
export const DEFAULT_SEND_FILTERS: SendFilters = { status: 'dead_lettered' };

function isEventStatus(v: string): v is EventStatus {
  return (EVENT_STATUS as readonly string[]).includes(v);
}

/** Read event filters from URL params — the source of truth for shareable, refresh-safe state. */
export function parseEventFilters(params: URLSearchParams): EventFilters {
  const filters: EventFilters = {};
  const status = params.get('status');
  if (status && isEventStatus(status)) filters.status = status;
  const source = params.get('source');
  if (source) filters.source = source;
  const from = params.get('from');
  if (from) filters.from = from;
  const to = params.get('to');
  if (to) filters.to = to;
  return filters;
}

/** Serialize event filters to URL params (omitting empties), for the query string and the API. */
export function eventFiltersToSearchParams(filters: EventFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.status) p.set('status', filters.status);
  if (filters.source) p.set('source', filters.source);
  if (filters.from) p.set('from', filters.from);
  if (filters.to) p.set('to', filters.to);
  return p;
}
