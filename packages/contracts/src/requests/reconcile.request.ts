import { z } from 'zod';

/** Which gaps a report should include. Defaults to `all` so the window is the only filter. */
export const GAP_FILTER = ['all', 'open', 'resolved'] as const;
export type GapFilter = (typeof GAP_FILTER)[number];

/** Optional time window + open/resolved filter for GET /reconcile. */
export const reconcileQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  status: z.enum(GAP_FILTER).optional(),
});

export type ReconcileQuery = z.infer<typeof reconcileQuerySchema>;

export interface DateRange {
  from?: string;
  to?: string;
}
