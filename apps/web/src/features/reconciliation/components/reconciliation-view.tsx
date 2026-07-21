'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { GAP_TYPE, type GapDto, type GapType } from '@conduit/contracts';
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
    <div className="flex items-center justify-between gap-4 border-b border-[var(--color-border)] py-2.5 last:border-0">
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
        <span className="shrink-0 font-mono text-xs text-[var(--color-muted)]">{gap.sendId}</span>
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Reconciliation</h1>
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
              <div className="mb-3 flex items-center gap-3">
                <Badge tone="warning">{meta.label}</Badge>
                <span className="text-sm text-[var(--color-muted)]">{meta.blurb}</span>
                <span className="ml-auto text-sm font-medium tabular-nums">{gaps.length}</span>
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
