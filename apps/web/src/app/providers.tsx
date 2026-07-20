'use client';

import { useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { makeQueryClient } from '@/lib/query-client';
import { useConduitStream } from '@/lib/sse';
import { Toaster } from '@/components/ui/toaster';

function StreamBridge() {
  useConduitStream();
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={client}>
      <StreamBridge />
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
