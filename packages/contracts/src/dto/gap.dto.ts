import type { GapType } from '../enums';

export interface GapDto {
  id: string;
  type: GapType;
  eventId: string | null;
  sendId: string | null;
  detail: string;
  detectedAt: string;
  resolvedAt: string | null;
}

/**
 * Counts over the gaps returned by this report (i.e. within the requested window/filter).
 * `open` / `resolved` split the same set — `open + resolved === total`.
 */
export type GapSummary = Record<GapType, number> & {
  total: number;
  open: number;
  resolved: number;
};

export interface ReconcileReportDto {
  gaps: GapDto[];
  summary: GapSummary;
  /**
   * When the reconciler last completed a pass, or `null` if it has not run since boot.
   * Powers the health strip — a stale value means the reconciler is wedged.
   */
  lastRunAt: string | null;
  /** True when there are no OPEN gaps in this report's window. */
  invariantHolds: boolean;
}
