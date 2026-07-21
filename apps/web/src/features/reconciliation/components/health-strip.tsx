'use client';

import type { ReconcileReportDto } from '@conduit/contracts';
import { Badge } from '@/components/ui/badge';
import { useStreamStore } from '@/stores/stream.store';

export function HealthStrip({ report }: { report: ReconcileReportDto }) {
  const stream = useStreamStore((state) => state.status);

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <Badge tone={report.invariantHolds ? 'success' : 'danger'}>
        {report.invariantHolds ? 'invariant holds' : 'invariant broken'}
      </Badge>
      <span className="text-[var(--color-muted)]">
        {/* null until the reconciler completes its first pass since boot. */}
        {report.lastRunAt
          ? `last run ${new Date(report.lastRunAt).toLocaleTimeString()}`
          : 'not yet run'}
      </span>
      <span className="text-[var(--color-muted)]">· stream: {stream}</span>
    </div>
  );
}
