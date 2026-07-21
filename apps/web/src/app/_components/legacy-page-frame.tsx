import type { ReactNode } from 'react';

export function LegacyPageFrame({ children }: { children: ReactNode }) {
  return (
    <main className="access-scroll h-[calc(100dvh-118px)] min-h-0 overflow-y-auto rounded-r-[28px] bg-gradient-to-b from-[#080808]/96 via-[#0b0b0b]/96 to-black/96 px-3 pb-[86px] pt-8 sm:h-[calc(100dvh-24px)] sm:px-5 sm:pb-7 sm:pt-9 lg:px-6">
      <div className="telemetry-page-content w-full max-w-none">{children}</div>
    </main>
  );
}
