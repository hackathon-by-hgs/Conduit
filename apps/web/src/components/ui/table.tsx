import type { ReactNode } from 'react';

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-[#262626] bg-[#0c0c0c]">
      {/* Rail header */}
      <div
        className="flex min-h-[46px] items-center gap-[14px] border-b border-[#262626] px-5 font-mono text-[9px] uppercase tracking-[0.16em] text-[#666]"
        aria-hidden="true"
      >
        <span>LIVE REGISTER</span>
        <i className="h-px flex-1 bg-[#262626]" />
        <b className="font-semibold text-[#a01016]">CONDUIT / IO</b>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-[13px]">{children}</table>
      </div>
    </div>
  );
}

export function THead({ columns }: { columns: string[] }) {
  return (
    <thead className="bg-[#111]">
      <tr>
        {columns.map((column) => (
          <th
            key={column}
            className="px-5 py-[15px] text-left font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-[#666]"
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
    <tr className="border-t border-[#262626] text-[#a3a3a3] transition-colors duration-[160ms] ease-linear hover:bg-[#161616] hover:text-[#f5f5f5]">
      {children}
    </tr>
  );
}

export function TCell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`px-5 py-[17px] align-middle ${className}`}>{children}</td>;
}
