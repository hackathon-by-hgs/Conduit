import { describe, expect, it } from 'vitest';
import type { GapDto } from '@conduit/contracts';
import { csvFilename, gapsToCsv } from './reconciliation.csv';

const gap = (over: Partial<GapDto> = {}): GapDto => ({
  id: 'gap_1',
  type: 'no_send',
  eventId: 'evt_1',
  sendId: null,
  detail: 'Processed event evt_1 has no send in a terminal state.',
  detectedAt: '2026-07-19T12:00:00.000Z',
  resolvedAt: null,
  ...over,
});

/** Split on CRLF and drop the trailing empty element from the final newline. */
function rows(csv: string): string[] {
  return csv.split('\r\n').slice(0, -1);
}

describe('gapsToCsv', () => {
  it('emits a header even with no gaps', () => {
    const csv = gapsToCsv([]);
    expect(rows(csv)).toEqual([
      'id,type,eventId,sendId,detail,detectedAt,resolvedAt,status',
    ]);
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('writes one row per gap and derives an open/resolved status column', () => {
    const csv = rows(gapsToCsv([gap(), gap({ id: 'gap_2', resolvedAt: '2026-07-19T12:05:00.000Z' })]));
    expect(csv).toHaveLength(3);
    expect(csv[1]?.endsWith(',open')).toBe(true);
    expect(csv[2]?.endsWith(',resolved')).toBe(true);
  });

  it('renders a null eventId/sendId as an empty field, not "null"', () => {
    const csv = rows(gapsToCsv([gap({ eventId: null, sendId: null })]));
    expect(csv[1]?.startsWith('gap_1,no_send,,,')).toBe(true);
  });

  it('quotes and escapes commas, quotes and newlines (RFC 4180)', () => {
    const csv = rows(gapsToCsv([gap({ detail: 'a,b "quoted"\nsecond line' })]));
    expect(csv[1]).toContain('"a,b ""quoted""\nsecond line"');
  });

  /**
   * Gap details embed ids and provider error strings. A cell starting with =, +, - or @ is
   * executed as a formula by Excel/Sheets, so it must be neutralised on export.
   */
  it('neutralises spreadsheet formula injection', () => {
    const csv = rows(gapsToCsv([gap({ detail: '=cmd|calc!A1' })]));
    expect(csv[1]).toContain("'=cmd|calc!A1");
    expect(csv[1]).not.toMatch(/,=cmd/);

    for (const dangerous of ['+1', '-1', '@SUM(A1)']) {
      const row = rows(gapsToCsv([gap({ detail: dangerous })]))[1] ?? '';
      expect(row).toContain(`'${dangerous}`);
    }
  });
});

describe('csvFilename', () => {
  it('is timestamped and free of characters that break Content-Disposition', () => {
    const name = csvFilename(new Date('2026-07-19T12:00:00.000Z'));
    expect(name).toBe('conduit-reconciliation-2026-07-19T12-00-00-000Z.csv');
    expect(name).not.toMatch(/[:"]/);
  });
});
