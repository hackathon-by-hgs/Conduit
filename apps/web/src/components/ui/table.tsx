import type { ReactNode } from 'react';

export function Table({ children }: { children: ReactNode }) {
  return (
    <div data-route-table className="overflow-hidden rounded-[18px] bg-gradient-to-b from-[#080808]/96 via-[#0b0b0b]/96 to-black/96 sm:rounded-[22px]">
      {/* Rail header */}
      <div
        className="flex min-h-[40px] items-center gap-3 border-b border-white/[0.07] px-3 font-mono text-[8px] uppercase tracking-[0.16em] text-white/34 sm:px-4"
        aria-hidden="true"
      >
        <span>LIVE REGISTER</span>
        <i className="h-px flex-1 bg-white/[0.07]" />
        <b className="font-semibold text-[#a01016]">CONDUIT / IO</b>
      </div>
      <div className="access-scroll overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-[12px] sm:min-w-[760px] sm:text-[13px]">{children}</table>
      </div>
    </div>
  );
}

export function THead({ columns }: { columns: string[] }) {
  return (
    <thead className="bg-white/[0.025]">
      <tr>
        {columns.map((column) => (
          <th
            key={column}
            className="px-3 py-3 text-left font-mono text-[8px] font-medium uppercase tracking-[0.14em] text-white/34 sm:px-4"
          >
            {column}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export function TRow({ children }: { children: ReactNode }) {
  return (
    <tr className="border-t border-white/[0.065] text-white/58 transition-colors duration-[160ms] ease-linear hover:bg-white/[0.035] hover:text-[#f5f5f5]">
      {children}
    </tr>
  );
}

export function TCell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`px-3 py-3.5 align-middle sm:px-4 ${className}`}>{children}</td>;
}
