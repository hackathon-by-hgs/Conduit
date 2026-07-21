import type { Metadata } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import './globals.css';
import './telemetry.css';
import { Providers } from './providers';
import { AppShell } from './_components/app-shell';

const fontVariables = {
  '--font-outfit': 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  '--font-jetbrains-mono': 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
} as CSSProperties;

export const metadata: Metadata = {
  title: 'Conduit',
  description: 'Configure SDK permissions, teams, and API keys with a live effective-access preview.',
  icons: {
    icon: '/icon.svg',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" style={fontVariables} className="h-dvh overflow-hidden bg-black">
      <body className="h-dvh overflow-hidden bg-black">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
