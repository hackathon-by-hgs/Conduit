import type { ReconcileReportDto } from '@conduit/contracts';

const HEADERS = ['type', 'detail', 'event_id', 'send_id', 'detected_at', 'resolved_at'] as const;

/** Escape a value for CSV: quote when it contains a comma, quote, or newline. */
function cell(value: string | null): string {
  const v = value ?? '';
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/**
 * Serialize a reconciliation report to CSV — one row per gap. Pure and
 * deterministic so it can be unit-tested; the UI wires it to a download control.
 */
export function reconciliationCsv(report: ReconcileReportDto): string {
  const rows = report.gaps.map((g) =>
    [g.type, g.detail, g.eventId, g.sendId, g.detectedAt, g.resolvedAt].map(cell).join(','),
  );
  return [HEADERS.join(','), ...rows].join('\n');
}
