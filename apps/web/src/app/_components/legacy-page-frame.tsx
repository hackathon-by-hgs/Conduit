import type { ReactNode } from 'react';

export function LegacyPageFrame({ children }: { children: ReactNode }) {
  return (
    <main className="telemetry-page-frame min-h-[calc(100dvh-48px)] bg-[#070707] px-[12px] pb-[86px] pt-[14px] sm:min-h-[calc(100dvh-26px)] sm:px-6 sm:py-5 lg:px-8 lg:py-7">
      <div className="telemetry-page-content mx-auto max-w-[1480px] w-full">{children}</div>
    </main>
  );
}
