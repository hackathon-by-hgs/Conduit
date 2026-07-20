import { queryOptions } from '@tanstack/react-query';
import { API_ROUTES, type DateRange, type ReconcileReportDto } from '@conduit/contracts';
import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

function toParams(range?: DateRange): string {
  if (!range) return '';
  const p = new URLSearchParams();
  if (range.from) p.set('from', range.from);
  if (range.to) p.set('to', range.to);
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** Reconciliation report, optionally scoped to a time window (gap filtering). */
export const reconcileQueryOptions = (range?: DateRange) =>
  queryOptions({
    queryKey: queryKeys.reconcile.report(range),
    queryFn: () =>
      api.get<ReconcileReportDto>(`${API_ROUTES.reconcile.report}${toParams(range)}`),
  });
