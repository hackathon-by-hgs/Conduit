import type { DateRange } from '@conduit/contracts';
import type { EventFilters, SendFilters } from './filters';

/** Centralised key factory — makes invalidation surgical. */
export const queryKeys = {
  events: {
    all: ['events'] as const,
    list: (f: EventFilters) => [...queryKeys.events.all, 'list', f] as const,
    infinite: (f: EventFilters) => [...queryKeys.events.all, 'infinite', f] as const,
    detail: (id: string) => [...queryKeys.events.all, 'detail', id] as const,
  },
  sends: {
    all: ['sends'] as const,
    list: (f: SendFilters) => [...queryKeys.sends.all, 'list', f] as const,
    infinite: (f: SendFilters) => [...queryKeys.sends.all, 'infinite', f] as const,
  },
  reconcile: {
    all: ['reconcile'] as const,
    report: (r?: DateRange) => [...queryKeys.reconcile.all, 'report', r ?? null] as const,
  },
  stats: {
    current: () => ['stats'] as const,
  },
} as const;
