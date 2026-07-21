import type { ReactNode } from 'react';
import { WarningCircle } from '@phosphor-icons/react/dist/ssr';

export function LoadingState({ label = 'Loading telemetry' }: { label?: string }) {
  return (
    <div
      data-route-state
      className="telemetry-state telemetry-loading-state relative flex min-h-[120px] flex-col items-start gap-5 overflow-hidden rounded-[18px] bg-gradient-to-b from-[#080808]/96 via-[#0b0b0b]/96 to-black/96 p-4 sm:flex-row sm:items-center sm:rounded-[20px] sm:p-5"
      role="status"
    >
      <div className="telemetry-state-copy min-w-0">
        <span className="font-mono text-[8px] font-medium uppercase tracking-[0.18em] text-white/34">DATA LINK / SYNC</span>
        <strong className="mt-2 block font-sans text-[15px] font-semibold text-[#f5f5f5]">{label}</strong>
      </div>
      <div className="telemetry-loading-segments flex w-full gap-[4px] sm:ml-auto sm:w-[min(38vw,430px)]" aria-hidden="true">
        {Array.from({ length: 18 }, (_, index) => (
          <i key={index} className="telemetry-loader-seg h-[28px] w-full -skew-x-[12deg] bg-[#262626]" style={{ animationDelay: `${[80,160,240][index % 3]}ms` }} />
        ))}
      </div>
    </div>
  );
}

export function ErrorState({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : 'Something went wrong';

  return (
    <div
      data-route-state
      className="telemetry-state relative flex min-h-[120px] flex-col items-start gap-4 overflow-hidden rounded-[18px] border border-[#A01016]/35 bg-gradient-to-b from-[#080808]/96 via-[#0b0b0b]/96 to-black/96 p-4 sm:flex-row sm:items-center sm:gap-5 sm:rounded-[20px] sm:p-5"
      role="alert"
    >
      <WarningCircle weight="bold" className="h-9 w-9 shrink-0 text-[#a01016]" />
      <div className="telemetry-state-copy min-w-0">
        <span className="font-mono text-[8px] font-medium uppercase tracking-[0.18em] text-white/34">DATA LINK / INTERRUPTED</span>
        <strong className="mt-2 block font-sans text-[15px] font-semibold text-[#f5f5f5]">Live source unavailable</strong>
        <p className="mt-[7px] break-all text-[12px] text-[#666]">{message}</p>
      </div>
      <b className="font-mono text-[9px] uppercase tracking-[0.13em] text-[#a01016] sm:ml-auto">OFFLINE</b>
    </div>
  );
}

export function EmptyState({ children = 'Nothing here yet.' }: { children?: ReactNode }) {
  return (
    <div data-route-state className="telemetry-state relative flex min-h-[120px] flex-col items-center justify-center gap-4 overflow-hidden rounded-[18px] bg-gradient-to-b from-[#080808]/96 via-[#0b0b0b]/96 to-black/96 p-4 text-center sm:flex-row sm:gap-5 sm:rounded-[20px] sm:p-5 sm:text-left">
      {/* Radar circle with crosshairs and blip — pseudo-elements handled inline */}
      <div
        className="telemetry-empty-radar relative h-16 w-16 shrink-0 rounded-full border border-[#2e2e2e]
          before:absolute before:left-1/2 before:top-1/2 before:h-px before:w-full before:-translate-x-1/2 before:-translate-y-1/2 before:bg-[#2e2e2e]
          after:absolute after:left-1/2 after:top-1/2 after:h-full after:w-px after:-translate-x-1/2 after:-translate-y-1/2 after:bg-[#2e2e2e]"
        aria-hidden="true"
      >
        <i className="absolute left-[42px] top-[19px] h-[6px] w-[6px] rounded-full bg-[#a01016]" />
      </div>
      <div className="telemetry-state-copy min-w-0">
        <span className="font-mono text-[8px] font-medium uppercase tracking-[0.18em] text-white/34">MONITOR / CLEAR</span>
        <strong className="mt-2 block font-sans text-[15px] font-semibold text-[#f5f5f5]">{children}</strong>
      </div>
    </div>
  );
}
