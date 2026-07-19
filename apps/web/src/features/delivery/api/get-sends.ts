import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { API_ROUTES, type Paginated, type SendDto } from '@conduit/contracts';
import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import type { SendFilters } from '@/lib/filters';

function toParams(f: SendFilters, cursor?: string): string {
  const p = new URLSearchParams();
  if (f.status) p.set('status', f.status);
  if (cursor) p.set('cursor', cursor);
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** Single page of sends — the flat DLQ view. */
export const sendsQueryOptions = (filters: SendFilters) =>
  queryOptions({
    queryKey: queryKeys.sends.list(filters),
    queryFn: () => api.get<Paginated<SendDto>>(`${API_ROUTES.sends.list}${toParams(filters)}`),
  });

/** Cursor-paginated sends — for a DLQ that pages through large queues. */
export const sendsInfiniteQueryOptions = (filters: SendFilters) =>
  infiniteQueryOptions({
    queryKey: queryKeys.sends.infinite(filters),
    queryFn: ({ pageParam }) =>
      api.get<Paginated<SendDto>>(`${API_ROUTES.sends.list}${toParams(filters, pageParam)}`),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
