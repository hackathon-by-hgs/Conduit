import type { Metadata } from 'next';
import { JetBrains_Mono, Outfit } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';
import './telemetry.css';
import { Providers } from './providers';
import { AppShell } from './_components/app-shell';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  weight: ['300', '400', '500', '600', '700', '800'],
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
});

export const metadata: Metadata = {
  title: 'Conduit - Access Surface',
  description: 'Configure SDK permissions, teams, and API keys with a live effective-access preview.',
  icons: {
    icon: '/icon.svg',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} ${jetBrainsMono.variable} h-dvh overflow-hidden bg-black`}>
      <body className="h-dvh overflow-hidden bg-black">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
