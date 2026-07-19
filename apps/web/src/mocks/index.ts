import { mockEventDetail, mockEvents, mockReport, mockSends, mockStats } from './fixtures';

export function isMockMode(): boolean {
  return process.env.NEXT_PUBLIC_USE_MOCKS === 'true';
}

// Session-local state so replay behaves believably: a replayed send leaves the
// DLQ and stays gone across refetches, exactly as the real API would report it.
const replayed = new Set<string>();

/** Resolve a request path to a typed fixture. Types are identical to the real API. */
export function mockResolve<T>(path: string, init?: RequestInit): Promise<T> {
  const rawPath = path.split('?')[0] ?? path;

  const eventDetail = rawPath.match(/^\/events\/([^/]+)$/);
  if (eventDetail) return Promise.resolve(mockEventDetail(eventDetail[1]) as T);
  if (rawPath === '/events') return Promise.resolve(mockEvents as T);

  const replay = rawPath.match(/^\/sends\/([^/]+)\/replay$/);
  if (replay && init?.method === 'POST') {
    const id = replay[1];
    replayed.add(id);
    const source = mockSends.items.find((s) => s.id === id) ?? mockSends.items[0];
    return Promise.resolve({ ...source, id, status: 'pending', deliveredAt: null } as T);
  }
  if (rawPath === '/sends') {
    const items = mockSends.items.filter((s) => !replayed.has(s.id));
    return Promise.resolve({ ...mockSends, items, total: items.length } as T);
  }

  if (rawPath === '/reconcile') return Promise.resolve(mockReport as T);
  if (rawPath === '/stats') return Promise.resolve(mockStats as T);

  return Promise.reject(new Error(`No mock registered for ${path}`));
}
