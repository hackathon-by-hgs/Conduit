import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div data-route-card className={`overflow-hidden rounded-[20px] bg-gradient-to-b from-[#080808]/96 via-[#0b0b0b]/96 to-black/96 p-4 text-[#f5f5f5] ${className}`}>
      {children}
    </div>
  );
}

export function StatCard({ label, value }: { label: string; value: string | number }) {
  const number = typeof value === 'number' ? value : Number(value);
  const activeSegments = Number.isFinite(number) ? Math.max(1, Math.min(10, number % 11)) : 0;

  return (
    <div data-route-card className="min-w-0 overflow-hidden bg-gradient-to-b from-[#080808]/96 via-[#0b0b0b]/96 to-black/96 p-4 text-[#f5f5f5]">
      <div className="flex items-center justify-between overflow-hidden">
        <p className="overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[8px] font-medium uppercase tracking-[0.18em] text-white/36">{label}</p>
        <span className="font-mono text-[8px] text-white/24">SYS</span>
      </div>
      <p className="mt-4 font-mono text-[clamp(24px,2.4vw,34px)] font-medium leading-[1] tracking-[-0.06em] text-[#f5f5f5]">{value}</p>
      <div className="mt-4 flex gap-[3px]" aria-hidden="true">
        {Array.from({ length: 10 }, (_, index) => (
          <i
            key={index}
            className={`block h-[3px] w-full -skew-x-[15deg] ${index < activeSegments ? 'bg-[#A01016]' : 'bg-white/[0.08]'}`}
          />
        ))}
      </div>
    </div>
  );
}
