import type { EventDto, GapType, Paginated, ReconcileReportDto } from '@conduit/contracts';
import { eventList, mockEventDetail, mockReport, mockSends, mockStats } from './fixtures';

export function isMockMode(): boolean {
  return process.env.NEXT_PUBLIC_USE_MOCKS === 'true';
}

/** Filter the mock report to a time window so gap filtering is exercisable. */
function reportInWindow(from: string | null, to: string | null): ReconcileReportDto {
  if (!from && !to) return mockReport;

  const fromMs = from ? Date.parse(from) : Number.NEGATIVE_INFINITY;
  const toMs = to ? Date.parse(to) : Number.POSITIVE_INFINITY;
  const gaps = mockReport.gaps.filter((g) => {
    const at = Date.parse(g.detectedAt);
    return at >= fromMs && at <= toMs;
  });

  const summary = gaps.reduce(
    (acc, g) => ({ ...acc, [g.type]: acc[g.type] + 1, total: acc.total + 1 }),
    { no_send: 0, orphan_send: 0, duplicate_send: 0, stuck: 0, total: 0 } as Record<
      GapType,
      number
    > & { total: number },
  );

  return { ...mockReport, gaps, summary, invariantHolds: gaps.length === 0 };
}

/** Slice an already-filtered list into a cursor page, mirroring the real API. */
function paginate<T>(items: T[], params: URLSearchParams): Paginated<T> {
  const limit = Number(params.get('limit') ?? '20');
  const start = Number(params.get('cursor') ?? '0');
  const page = items.slice(start, start + limit);
  const nextStart = start + limit;
  return {
    items: page,
    nextCursor: nextStart < items.length ? String(nextStart) : null,
    total: items.length,
  };
}

/** Apply the /events query filters (status, source, time window). */
function filterEvents(params: URLSearchParams): EventDto[] {
  const status = params.get('status');
  const source = params.get('source');
  const from = params.get('from');
  const to = params.get('to');
  return eventList.filter((e) => {
    if (status && e.status !== status) return false;
    if (source && !e.source.toLowerCase().includes(source.toLowerCase())) return false;
    if (from && Date.parse(e.receivedAt) < Date.parse(from)) return false;
    if (to && Date.parse(e.receivedAt) > Date.parse(to)) return false;
    return true;
  });
}

// Session-local state so replay behaves believably: a replayed send leaves the
// DLQ and stays gone across refetches, exactly as the real API would report it.
const replayed = new Set<string>();

/** Resolve a request path to a typed fixture. Types are identical to the real API. */
export function mockResolve<T>(path: string, init?: RequestInit): Promise<T> {
  const rawPath = path.split('?')[0] ?? path;

  const eventDetail = rawPath.match(/^\/events\/([^/]+)$/);
  if (eventDetail) return Promise.resolve(mockEventDetail(eventDetail[1]) as T);
  if (rawPath === '/events') {
    const params = new URLSearchParams(path.split('?')[1] ?? '');
    return Promise.resolve(paginate(filterEvents(params), params) as T);
  }

  const replay = rawPath.match(/^\/sends\/([^/]+)\/replay$/);
  if (replay && init?.method === 'POST') {
    const id = replay[1];
    replayed.add(id);
    const source = mockSends.items.find((s) => s.id === id) ?? mockSends.items[0];
    return Promise.resolve({ ...source, id, status: 'pending', deliveredAt: null } as T);
  }
  if (rawPath === '/sends') {
    const params = new URLSearchParams(path.split('?')[1] ?? '');
    const all = mockSends.items.filter((s) => !replayed.has(s.id));
    return Promise.resolve(paginate(all, params) as T);
  }

  if (rawPath === '/reconcile') {
    const params = new URLSearchParams(path.split('?')[1] ?? '');
    return Promise.resolve(reportInWindow(params.get('from'), params.get('to')) as T);
  }
  if (rawPath === '/stats') return Promise.resolve(mockStats as T);

  return Promise.reject(new Error(`No mock registered for ${path}`));
}
