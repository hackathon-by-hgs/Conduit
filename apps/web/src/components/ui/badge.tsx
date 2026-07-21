import type { ReactNode } from 'react';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const TONES: Record<Tone, string> = {
  neutral: 'telemetry-badge--neutral',
  success: 'telemetry-badge--success',
  warning: 'telemetry-badge--warning',
  danger: 'telemetry-badge--danger',
  info: 'telemetry-badge--info',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`telemetry-badge ${TONES[tone]}`}>
      <i aria-hidden="true" />
      {children}
    </span>
  );
}
