import { API_ROUTES, type DateRange, type ReconcileReportDto } from '@conduit/contracts';
import { api } from '@/lib/api-client';
import { downloadTextFile } from '@/lib/download';
import { isMockMode } from '@/mocks';
import { reconciliationCsv } from './csv';

function toParams(range?: DateRange): string {
  if (!range) return '';
  const p = new URLSearchParams();
  if (range.from) p.set('from', range.from);
  if (range.to) p.set('to', range.to);
  const s = p.toString();
  return s ? `?${s}` : '';
}

/**
 * Download the reconciliation report as CSV.
 *
 * Live: streams from the API's `GET /reconcile/export.csv` so the CSV is generated
 * by a single source of truth (the same window filter the report uses). Mock/offline:
 * falls back to serializing the already-loaded report client-side.
 */
export async function downloadReconciliationCsv(
  report: ReconcileReportDto,
  range?: DateRange,
): Promise<void> {
  const csv = isMockMode()
    ? reconciliationCsv(report)
    : await api.getText(`${API_ROUTES.reconcile.exportCsv}${toParams(range)}`);
  downloadTextFile('reconciliation-report.csv', csv);
}
