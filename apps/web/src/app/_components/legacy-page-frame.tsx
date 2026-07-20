import type { ReactNode } from 'react';

export function LegacyPageFrame({ children }: { children: ReactNode }) {
  return (
    <main className="telemetry-page-frame min-h-[calc(100dvh-48px)] px-4 py-5 sm:min-h-[calc(100dvh-26px)] sm:px-6 lg:px-8 lg:py-7">
      <div className="telemetry-page-content mx-auto max-w-[1480px]">{children}</div>
    </main>
  );
}
