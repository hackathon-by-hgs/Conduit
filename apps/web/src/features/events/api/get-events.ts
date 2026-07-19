import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { API_ROUTES, type EventDto, type Paginated } from '@conduit/contracts';
import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { eventFiltersToSearchParams, type EventFilters } from '@/lib/filters';

function toParams(f: EventFilters, cursor?: string): string {
  const p = eventFiltersToSearchParams(f);
  if (cursor) p.set('cursor', cursor);
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** Single page of events. */
export const eventsQueryOptions = (filters: EventFilters) =>
  queryOptions({
    queryKey: queryKeys.events.list(filters),
    queryFn: () =>
      api.get<Paginated<EventDto>>(`${API_ROUTES.events.list}${toParams(filters)}`),
  });

/** Cursor-paginated events — the live list pages through the full stream. */
export const eventsInfiniteQueryOptions = (filters: EventFilters) =>
  infiniteQueryOptions({
    queryKey: queryKeys.events.infinite(filters),
    queryFn: ({ pageParam }) =>
      api.get<Paginated<EventDto>>(`${API_ROUTES.events.list}${toParams(filters, pageParam)}`),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
