'use client';

import { useSearchParams } from 'next/navigation';
import { HIGHLIGHT_PARAM } from '@/lib/deep-link';

/**
 * The send id to highlight on the event detail view, read from `?highlight=`.
 *
 * This is the FE1 end of FE2's gap deep-link contract: a gap linking to
 * `/events/[id]?highlight=<sendId>` lands here, and the detail UI focuses the
 * matching send. Returns null when no send is targeted.
 */
export function useHighlightedSendId(): string | null {
  return useSearchParams().get(HIGHLIGHT_PARAM);
}
