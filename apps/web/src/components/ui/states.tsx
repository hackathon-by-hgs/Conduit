import type { ReactNode } from 'react';
import { WarningCircle } from '@phosphor-icons/react/dist/ssr';

export function LoadingState({ label = 'Loading telemetry' }: { label?: string }) {
  return (
    <div className="telemetry-state telemetry-loading-state" role="status">
      <div className="telemetry-state-copy">
        <span>DATA LINK / SYNC</span>
        <strong>{label}</strong>
      </div>
      <div className="telemetry-loading-segments" aria-hidden="true">
        {Array.from({ length: 18 }, (_, index) => <i key={index} />)}
      </div>
    </div>
  );
}

export function ErrorState({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : 'Something went wrong';

  return (
    <div className="telemetry-state telemetry-error-state" role="alert">
      <WarningCircle weight="bold" />
      <div className="telemetry-state-copy">
        <span>DATA LINK / INTERRUPTED</span>
        <strong>Live source unavailable</strong>
        <p>{message}</p>
      </div>
      <b>OFFLINE</b>
    </div>
  );
}

export function EmptyState({ children = 'Nothing here yet.' }: { children?: ReactNode }) {
  return (
    <div className="telemetry-state telemetry-empty-state">
      <div className="telemetry-empty-radar" aria-hidden="true"><i /></div>
      <div className="telemetry-state-copy">
        <span>MONITOR / CLEAR</span>
        <strong>{children}</strong>
      </div>
    </div>
  );
}
