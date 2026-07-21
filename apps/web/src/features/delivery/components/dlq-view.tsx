'use client';

import { useQuery } from '@tanstack/react-query';
import { TelemetryPageHeader } from '@/app/_components/telemetry-page-header';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { StatsCards } from '@/features/stats/components/stats-cards';
import { DEFAULT_SEND_FILTERS } from '@/lib/filters';
import { sendsQueryOptions } from '../api/get-sends';
import { DlqTable } from './dlq-table';

export function DlqView() {
  const { data, isLoading, isError, error } = useQuery(sendsQueryOptions(DEFAULT_SEND_FILTERS));

  return (
    <section className="flex flex-col gap-[18px]">
      <TelemetryPageHeader
        eyebrow="DLQ / RECOVERY"
        title="Delivery Recovery"
        description="Review terminal delivery failures and control deliberate replay operations."
        status="Replay control"
        metric={data ? { label: 'Queued sends', value: data.items.length } : undefined}
      />
      <StatsCards />
      {isLoading ? <LoadingState label="Loading delivery telemetry" /> : null}
      {isError ? <ErrorState error={error} /> : null}
      {data ? (
        data.items.length ? (
          <DlqTable sends={data.items} />
        ) : (
          <EmptyState>
            No dead-lettered sends. Deliveries that exhaust their retries land here,
            where you can replay them.
          </EmptyState>
        )
      ) : null}
    </section>
  );
}
