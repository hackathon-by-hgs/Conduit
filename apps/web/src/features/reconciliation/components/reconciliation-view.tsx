'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { GAP_TYPE, type GapDto, type GapType } from '@conduit/contracts';
import { TelemetryPageHeader } from '@/app/_components/telemetry-page-header';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { reconcileQueryOptions } from '../api/get-reconcile';
import { gapDeepLink } from '../deep-link';
import { HealthStrip } from './health-strip';

const GAP_META: Record<GapType, { label: string; blurb: string }> = {
  no_send: { label: 'No send', blurb: 'A processed event that produced no send.' },
  orphan_send: { label: 'Orphan send', blurb: 'A send with no source event.' },
  duplicate_send: { label: 'Duplicate send', blurb: 'More than one send for the same event.' },
  stuck: { label: 'Stuck', blurb: 'A send that never reached a terminal state.' },
};

function GapRow({ gap }: { gap: GapDto }) {
  const href = gapDeepLink(gap);
  return (
    <div className="flex flex-col gap-3 border-b border-[var(--color-border)] py-2.5 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-sm">{gap.detail}</p>
        <p className="text-xs text-[var(--color-muted)]">
          Detected {new Date(gap.detectedAt).toLocaleString()}
        </p>
      </div>
      {href ? (
        <Link
          href={href}
        className="shrink-0 text-xs font-medium text-[var(--color-accent)] hover:underline"
        >
          {gap.sendId ? 'View send' : 'View event'}
        </Link>
      ) : gap.sendId ? (
        <span className="max-w-full shrink-0 truncate font-mono text-xs text-[var(--color-muted)] sm:max-w-[220px]">{gap.sendId}</span>
      ) : null}
    </div>
  );
}

export function ReconciliationView() {
  const { data, isLoading, isError, error } = useQuery(reconcileQueryOptions());

  if (isLoading || !data) return <LoadingState />;
  if (isError) return <ErrorState error={error} />;

  return (
    <section className="space-y-4">
      <TelemetryPageHeader
        eyebrow="REC / AUDIT"
        title="Reconciliation"
        description="Inspect missing, orphaned, duplicated, and stuck delivery records."
        status="Gap monitor"
        metric={{ label: 'Open gaps', value: data.gaps.length }}
      />

      <div data-route-card className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] bg-gradient-to-b from-[#080808]/96 via-[#0b0b0b]/96 to-black/96 p-4">
        <h2 className="font-sans text-[17px] font-semibold tracking-[-0.03em] text-white">Gap health</h2>
        <HealthStrip report={data} />
      </div>

      {data.gaps.length === 0 ? (
        <EmptyState>
          No open gaps. Every processed event has its expected send in a terminal state.
        </EmptyState>
      ) : (
        GAP_TYPE.map((type) => {
          const gaps = data.gaps.filter((g) => g.type === type);
          if (!gaps.length) return null;
          const meta = GAP_META[type];
          return (
            <Card key={type}>
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <Badge tone="warning">{meta.label}</Badge>
                <span className="text-sm text-[var(--color-muted)]">{meta.blurb}</span>
                <span className="text-sm font-medium tabular-nums sm:ml-auto">{gaps.length}</span>
              </div>
              {gaps.map((g) => (
                <GapRow key={g.id} gap={g} />
              ))}
            </Card>
          );
        })
      )}
    </section>
  );
}
