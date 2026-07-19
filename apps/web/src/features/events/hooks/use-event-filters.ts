'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { eventFiltersToSearchParams, parseEventFilters, type EventFilters } from '@/lib/filters';
import { useFiltersStore } from '@/stores/filters.store';

/**
 * Event filters, synced to the URL so state survives refresh and is shareable.
 *
 * The URL is the source of truth: the store is hydrated from the query string on
 * mount, and every change is written back with router.replace (no history spam).
 * Consumers read `filters` and call `setEventFilters` / `resetEventFilters` as
 * before — the sync is transparent.
 */
export function useEventFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters = useFiltersStore((s) => s.events);
  const setEventFilters = useFiltersStore((s) => s.setEventFilters);
  const replaceEventFilters = useFiltersStore((s) => s.replaceEventFilters);
  const resetEventFilters = useFiltersStore((s) => s.resetEventFilters);

  // Hydrate the store from the URL once, on mount.
  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    replaceEventFilters(parseEventFilters(new URLSearchParams(searchParams.toString())));
  }, [searchParams, replaceEventFilters]);

  const writeUrl = useCallback(
    (next: EventFilters) => {
      const qs = eventFiltersToSearchParams(next).toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  const update = useCallback(
    (patch: Partial<EventFilters>) => {
      setEventFilters(patch);
      writeUrl({ ...filters, ...patch });
    },
    [filters, setEventFilters, writeUrl],
  );

  const reset = useCallback(() => {
    resetEventFilters();
    writeUrl({});
  }, [resetEventFilters, writeUrl]);

  return { filters, setEventFilters: update, resetEventFilters: reset };
}
