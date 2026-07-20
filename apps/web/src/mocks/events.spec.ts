import { describe, expect, it } from 'vitest';
import type { EventDto, Paginated } from '@conduit/contracts';
import { mockResolve } from './index';

const events = (query = '') => mockResolve<Paginated<EventDto>>(`/events${query}`);

describe('mock /events', () => {
  it('returns the full list unfiltered', async () => {
    const res = await events();
    expect(res.total).toBe(6);
    expect(res.items).toHaveLength(6);
    expect(res.nextCursor).toBeNull();
  });

  it('filters by status', async () => {
    const res = await events('?status=processed');
    expect(res.items.length).toBeGreaterThan(0);
    expect(res.items.every((e) => e.status === 'processed')).toBe(true);
    expect(res.total).toBe(res.items.length);
  });

  it('filters by source (case-insensitive, partial)', async () => {
    const res = await events('?source=STRI');
    expect(res.items.every((e) => e.source === 'stripe')).toBe(true);
  });

  it('paginates with cursor and reports the next cursor', async () => {
    const page1 = await events('?limit=2');
    expect(page1.items).toHaveLength(2);
    expect(page1.total).toBe(6);
    expect(page1.nextCursor).toBe('2');

    const page2 = await events('?limit=2&cursor=2');
    expect(page2.items).toHaveLength(2);
    expect(page2.items[0].id).not.toBe(page1.items[0].id);

    const last = await events('?limit=2&cursor=4');
    expect(last.nextCursor).toBeNull();
  });

  it('combines a filter with pagination totals', async () => {
    const res = await events('?source=stripe&limit=2');
    expect(res.total).toBe(3);
    expect(res.items).toHaveLength(2);
    expect(res.nextCursor).toBe('2');
  });
});
