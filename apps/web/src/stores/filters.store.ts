import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { DEFAULT_EVENT_FILTERS, type EventFilters } from '@/lib/filters';

interface FiltersState {
  events: EventFilters;
  setEventFilters: (f: Partial<EventFilters>) => void;
  /** Replace the whole event filter set — used when hydrating from the URL. */
  replaceEventFilters: (f: EventFilters) => void;
  resetEventFilters: () => void;
}

export const useFiltersStore = create<FiltersState>()(
  devtools((set) => ({
    events: DEFAULT_EVENT_FILTERS,
    setEventFilters: (f) => set((s) => ({ events: { ...s.events, ...f } })),
    replaceEventFilters: (f) => set({ events: f }),
    resetEventFilters: () => set({ events: DEFAULT_EVENT_FILTERS }),
  })),
);
