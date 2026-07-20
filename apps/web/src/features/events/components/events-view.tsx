'use client';

import { useQuery } from '@tanstack/react-query';
import { TelemetryPageHeader } from '@/app/_components/telemetry-page-header';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useFiltersStore } from '@/stores/filters.store';
import { eventsQueryOptions } from '../api/get-events';
import { EventsTable } from './events-table';

export function EventsView() {
  const filters = useFiltersStore((state) => state.events);
  const { data, isLoading, isError, error } = useQuery(eventsQueryOptions(filters));

  return (
    <section className="telemetry-page-stack">
      <TelemetryPageHeader
        eyebrow="EVT / INGEST"
        title="Event Stream"
        description="Inspect normalized webhook traffic, processing state, and delivery handoff."
        status="Stream monitor"
        metric={data ? { label: 'Indexed events', value: data.total } : undefined}
      />

      {isLoading ? <LoadingState label="Synchronizing event telemetry" /> : null}
      {isError ? <ErrorState error={error} /> : null}
      {data ? (
        data.items.length ? (
          <EventsTable events={data.items} />
        ) : (
          <EmptyState>No events have entered the ingestion fabric.</EmptyState>
        )
      ) : null}
    </section>
  );
}
