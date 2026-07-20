'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { GAP_TYPE, type GapDto } from '@conduit/contracts';
import { TelemetryPageHeader } from '@/app/_components/telemetry-page-header';
import { Badge } from '@/components/ui/badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { reconcileQueryOptions } from '../api/get-reconcile';
import { HealthStrip } from './health-strip';

function GapItem({ gap }: { gap: GapDto }) {
  return (
    <div className="telemetry-gap-row">
      <div>
        <p>{gap.detail}</p>
        <time>{new Date(gap.detectedAt).toLocaleString()}</time>
      </div>
      {gap.eventId ? (
        <Link href={`/events/${gap.eventId}`}>Inspect event</Link>
      ) : null}
    </div>
  );
}

export function ReconciliationView() {
  const { data, isLoading, isError, error } = useQuery(reconcileQueryOptions());

  return (
    <section className="telemetry-page-stack">
      <TelemetryPageHeader
        eyebrow="SYS / INTEGRITY"
        title="Reconciliation Monitor"
        description="Validate event-to-delivery invariants and isolate gaps requiring operator attention."
        status="Integrity scan"
        metric={data ? { label: 'Open gaps', value: data.gaps.length } : undefined}
      />

      {isLoading ? <LoadingState label="Running reconciliation diagnostics" /> : null}
      {isError ? <ErrorState error={error} /> : null}
      {data ? (
        <>
          <div className="telemetry-inline-instrument"><HealthStrip report={data} /></div>
          {data.gaps.length === 0 ? (
            <EmptyState>All processed events satisfy the delivery invariant.</EmptyState>
          ) : (
            <div className="telemetry-gap-register">
              {GAP_TYPE.map((type) => {
                const gaps = data.gaps.filter((gap) => gap.type === type);
                if (!gaps.length) return null;
                return (
                  <section className="telemetry-gap-group" key={type}>
                    <header>
                      <Badge tone="warning">{type}</Badge>
                      <span>{gaps.length} detected</span>
                    </header>
                    {gaps.map((gap) => <GapItem key={gap.id} gap={gap} />)}
                  </section>
                );
              })}
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
