import type { ReactNode } from 'react';

export function LegacyPageFrame({ children }: { children: ReactNode }) {
  return (
    <main className="access-scroll h-[calc(100dvh-118px)] min-h-0 overflow-x-hidden overflow-y-auto rounded-none bg-gradient-to-b from-[#080808]/96 via-[#0b0b0b]/96 to-black/96 px-3 pb-[86px] pt-6 sm:h-[calc(100dvh-24px)] sm:rounded-r-[28px] sm:px-5 sm:pb-7 sm:pt-8 lg:px-6">
      <div className="telemetry-page-content w-full max-w-none">{children}</div>
    </main>
  );
}
