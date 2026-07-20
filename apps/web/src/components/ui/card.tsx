import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`telemetry-card ${className}`}>{children}</div>;
}

export function StatCard({ label, value }: { label: string; value: string | number }) {
  const number = typeof value === 'number' ? value : Number(value);
  const activeSegments = Number.isFinite(number) ? Math.max(1, Math.min(10, number % 11)) : 0;

  return (
    <Card className="telemetry-stat-card">
      <div className="telemetry-stat-heading">
        <p>{label}</p>
        <span>SYS</span>
      </div>
      <p className="telemetry-stat-value">{value}</p>
      <div className="telemetry-mini-meter" aria-hidden="true">
        {Array.from({ length: 10 }, (_, index) => (
          <i className={index < activeSegments ? 'is-active' : ''} key={index} />
        ))}
      </div>
    </Card>
  );
}
