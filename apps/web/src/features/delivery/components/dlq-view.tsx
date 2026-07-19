'use client';

import { useQuery } from '@tanstack/react-query';
import { DEFAULT_SEND_FILTERS } from '@/lib/filters';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { StatsCards } from '@/features/stats/components/stats-cards';
import { sendsQueryOptions } from '../api/get-sends';
import { DlqTable } from './dlq-table';

export function DlqView() {
  const { data, isLoading, isError, error } = useQuery(sendsQueryOptions(DEFAULT_SEND_FILTERS));

  return (
    <section className="space-y-4">
      <h1 className="text-lg font-semibold">Dead-letter queue</h1>
      <StatsCards />
      {isLoading ? <LoadingState /> : null}
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
