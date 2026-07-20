import type { GapDto } from '@conduit/contracts';

const COLUMNS = [
  'id',
  'type',
  'eventId',
  'sendId',
  'detail',
  'detectedAt',
  'resolvedAt',
  'status',
] as const;

/**
 * A leading =, +, - or @ makes a spreadsheet treat the cell as a formula. Gap details embed
 * ids and provider errors, so a crafted value could otherwise execute on open in Excel or
 * Sheets (CSV injection). Prefixing with an apostrophe neutralises it while keeping the
 * text readable.
 */
function neutralizeFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/** RFC 4180: wrap in quotes when the value contains a quote, comma or newline; double the quotes. */
function escapeCell(value: string | null): string {
  if (value === null || value === '') return '';
  const safe = neutralizeFormula(value);
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * Renders the reconciliation report as RFC 4180 CSV — the "exportable reconciliation
 * report" from the spec. A `status` column is derived so the file is readable without
 * having to reason about a null `resolvedAt`.
 */
export function gapsToCsv(gaps: GapDto[]): string {
  const rows = gaps.map((gap) =>
    [
      gap.id,
      gap.type,
      gap.eventId,
      gap.sendId,
      gap.detail,
      gap.detectedAt,
      gap.resolvedAt,
      gap.resolvedAt === null ? 'open' : 'resolved',
    ]
      .map(escapeCell)
      .join(','),
  );
  // Trailing newline so the file ends cleanly and appends behave.
  return [COLUMNS.join(','), ...rows].join('\r\n') + '\r\n';
}

/** Timestamped, filesystem-safe filename for the Content-Disposition header. */
export function csvFilename(now: Date): string {
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  return `conduit-reconciliation-${stamp}.csv`;
}
