import { describe, expect, it } from 'vitest';
import type { GapDto, GapType } from '@conduit/contracts';
import { gapDeepLink } from './deep-link';

function gap(over: Partial<GapDto> & { type: GapType }): GapDto {
  return {
    id: 'gap',
    eventId: null,
    sendId: null,
    detail: '',
    detectedAt: '2026-07-19T12:00:30.000Z',
    resolvedAt: null,
    ...over,
  };
}

describe('gapDeepLink', () => {
  it('links to the event when only an event is implicated', () => {
    expect(gapDeepLink(gap({ type: 'no_send', eventId: 'evt_2' }))).toBe('/events/evt_2');
  });

  it('highlights the send when one is implicated', () => {
    expect(gapDeepLink(gap({ type: 'duplicate_send', eventId: 'evt_1', sendId: 'snd_1' }))).toBe(
      '/events/evt_1?highlight=snd_1',
    );
  });

  it('returns null for an orphan send (no source event)', () => {
    expect(gapDeepLink(gap({ type: 'orphan_send', sendId: 'snd_orphan_9' }))).toBeNull();
  });

  it('encodes the send id', () => {
    expect(gapDeepLink(gap({ type: 'stuck', eventId: 'evt_5', sendId: 'snd/5 x' }))).toBe(
      '/events/evt_5?highlight=snd%2F5%20x',
    );
  });
});
