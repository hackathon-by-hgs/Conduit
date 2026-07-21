import { describe, expect, it } from 'vitest';
import type { ReconcileReportDto } from '@conduit/contracts';
import { reconciliationCsv } from './csv';

const report: ReconcileReportDto = {
  gaps: [
    {
      id: 'gap_1',
      type: 'no_send',
      eventId: 'evt_2',
      sendId: null,
      detail: 'Processed event evt_2 produced no send.',
      detectedAt: '2026-07-19T12:00:30.000Z',
      resolvedAt: null,
    },
    {
      id: 'gap_2',
      type: 'duplicate_send',
      eventId: 'evt_1',
      sendId: 'snd_1',
      detail: 'Two sends, one recipient',
      detectedAt: '2026-07-19T12:00:30.000Z',
      resolvedAt: null,
    },
  ],
  summary: {
    no_send: 1,
    orphan_send: 0,
    duplicate_send: 1,
    stuck: 0,
    total: 2,
    open: 2,
    resolved: 0,
  },
  lastRunAt: '2026-07-19T12:00:30.000Z',
  invariantHolds: false,
};

describe('reconciliationCsv', () => {
  it('emits a header and one row per gap', () => {
    const lines = reconciliationCsv(report).split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('type,detail,event_id,send_id,detected_at,resolved_at');
    expect(lines[1]).toContain('no_send');
    expect(lines[2]).toContain('duplicate_send');
  });

  it('renders null fields as empty cells', () => {
    const firstRow = reconciliationCsv(report).split('\n')[1];
    // eventId present, sendId null, resolvedAt null -> trailing empties
    expect(firstRow).toBe(
      'no_send,Processed event evt_2 produced no send.,evt_2,,2026-07-19T12:00:30.000Z,',
    );
  });

  it('quotes and escapes values containing commas or quotes', () => {
    const tricky: ReconcileReportDto = {
      ...report,
      gaps: [
        {
          ...report.gaps[0],
          detail: 'has, a comma and "quotes"',
        },
      ],
    };
    expect(reconciliationCsv(tricky).split('\n')[1]).toContain(
      '"has, a comma and ""quotes"""',
    );
  });

  it('returns just the header for an empty report', () => {
    const empty: ReconcileReportDto = { ...report, gaps: [] };
    expect(reconciliationCsv(empty)).toBe(
      'type,detail,event_id,send_id,detected_at,resolved_at',
    );
  });
});
