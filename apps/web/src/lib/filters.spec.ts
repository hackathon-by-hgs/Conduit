import { describe, expect, it } from 'vitest';
import { eventFiltersToSearchParams, parseEventFilters, type EventFilters } from './filters';

describe('parseEventFilters', () => {
  it('reads known params', () => {
    const p = new URLSearchParams('status=failed&source=stripe&from=2026-07-19&to=2026-07-20');
    expect(parseEventFilters(p)).toEqual({
      status: 'failed',
      source: 'stripe',
      from: '2026-07-19',
      to: '2026-07-20',
    });
  });

  it('ignores an invalid status', () => {
    expect(parseEventFilters(new URLSearchParams('status=bogus'))).toEqual({});
  });

  it('drops empty values', () => {
    expect(parseEventFilters(new URLSearchParams('source='))).toEqual({});
  });
});

describe('eventFiltersToSearchParams', () => {
  it('omits empty fields', () => {
    expect(eventFiltersToSearchParams({ status: 'processed' }).toString()).toBe('status=processed');
  });

  it('round-trips through parse', () => {
    const filters: EventFilters = { status: 'received', source: 'github', from: '2026-01-01' };
    expect(parseEventFilters(eventFiltersToSearchParams(filters))).toEqual(filters);
  });
});
