'use client';

import type { ReconcileReportDto } from '@conduit/contracts';
import { useStreamStore } from '@/stores/stream.store';

export function HealthStrip({ report }: { report: ReconcileReportDto }) {
  const stream = useStreamStore((state) => state.status);

  return (
    <div className={`telemetry-health-strip ${report.invariantHolds ? 'is-nominal' : 'is-fault'}`}>
      <div className="telemetry-health-dial" aria-hidden="true">
        <span>{report.invariantHolds ? 'OK' : '!'}</span>
      </div>
      <div className="telemetry-health-copy">
        <span>DELIVERY INVARIANT</span>
        <strong>{report.invariantHolds ? 'Nominal' : 'Integrity fault'}</strong>
        <p>Last diagnostic run {new Date(report.lastRunAt).toLocaleTimeString()}</p>
      </div>
      <div className="telemetry-health-wave" aria-hidden="true">
        {Array.from({ length: 20 }, (_, index) => <i key={index} />)}
      </div>
      <div className="telemetry-health-stream">
        <span>STREAM</span>
        <strong>{stream}</strong>
      </div>
    </div>
  );
}
