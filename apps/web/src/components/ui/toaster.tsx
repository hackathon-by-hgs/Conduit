'use client';

import { useEffect } from 'react';
import { useToastStore, type Toast } from '@/stores/toast.store';

const AUTO_DISMISS_MS = 4000;

/** Renders queued toasts. Mounted once, near the root. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);

  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast.id, dismiss]);

  const accent =
    toast.tone === 'success' ? 'border-l-emerald-400' : 'border-l-rose-400';

  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-3 rounded-lg border border-[var(--color-border)] border-l-2 ${accent} bg-[var(--color-surface)] px-4 py-3 text-sm`}
    >
      <span className="flex-1">{toast.message}</span>
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        className="text-[var(--color-muted)] hover:text-[var(--color-text)]"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
