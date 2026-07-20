import type { ReactNode } from 'react';

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="telemetry-table-shell">
      <div className="telemetry-table-rail" aria-hidden="true">
        <span>LIVE REGISTER</span><i /><b>CONDUIT / IO</b>
      </div>
      <div className="telemetry-table-scroll">
        <table className="telemetry-table">{children}</table>
      </div>
    </div>
  );
}

export function THead({ columns }: { columns: string[] }) {
  return (
    <thead className="telemetry-table-head">
      <tr>
        {columns.map((column) => <th key={column}>{column}</th>)}
      </tr>
    </thead>
  );
}

export function TRow({ children }: { children: ReactNode }) {
  return <tr className="telemetry-table-row">{children}</tr>;
}

export function TCell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={className}>{children}</td>;
}
