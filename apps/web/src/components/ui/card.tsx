import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-[22px] border border-[#262626] bg-[#111] p-5 text-[#f5f5f5] ${className}`}>
      {children}
    </div>
  );
}

export function StatCard({ label, value }: { label: string; value: string | number }) {
  const number = typeof value === 'number' ? value : Number(value);
  const activeSegments = Number.isFinite(number) ? Math.max(1, Math.min(10, number % 11)) : 0;

  return (
    // inside stat-grid, bg/border/radius/padding are overridden by grid context
    <div className="telemetry-stat-card min-w-0 overflow-hidden rounded-[22px] border border-[#262626] bg-[#111] p-[18px] text-[#f5f5f5]">
      <div className="flex items-center justify-between overflow-hidden">
        <p className="overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[#666]">{label}</p>
        <span className="font-mono text-[8px] text-[#444]">SYS</span>
      </div>
      <p className="mt-[18px] font-mono text-[clamp(28px,3vw,42px)] font-medium leading-[1] tracking-[-0.06em] text-[#f5f5f5]">{value}</p>
      <div className="mt-[20px] flex gap-[3px]" aria-hidden="true">
        {Array.from({ length: 10 }, (_, index) => (
          <i
            key={index}
            className={`block h-[4px] w-full -skew-x-[15deg] ${index < activeSegments ? 'bg-[#a01016]' : 'bg-[#262626]'}`}
          />
        ))}
      </div>
    </div>
  );
}
