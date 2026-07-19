import type {
  AttemptDto,
  EventDetailDto,
  EventDto,
  GapDto,
  Paginated,
  ReconcileReportDto,
  SendDto,
  SendWithAttemptsDto,
  StatsDto,
} from '@conduit/contracts';

const now = '2026-07-19T12:00:00.000Z';

const attempts = (sendId: string): AttemptDto[] => [
  {
    id: `${sendId}-a1`,
    sendId,
    attemptNo: 1,
    statusCode: 500,
    error: 'provider_unavailable',
    durationMs: 812,
    at: '2026-07-19T11:59:00.000Z',
    nextRetryAt: '2026-07-19T11:59:02.000Z',
  },
  {
    id: `${sendId}-a2`,
    sendId,
    attemptNo: 2,
    statusCode: 202,
    error: null,
    durationMs: 143,
    at: '2026-07-19T11:59:03.000Z',
    nextRetryAt: null,
  },
];

const sendsWithAttempts: SendWithAttemptsDto[] = [
  {
    id: 'snd_1',
    causedBy: 'evt_1',
    channel: 'email',
    to: 'user@example.com',
    status: 'sent',
    attempts: 2,
    lastError: null,
    createdAt: now,
    deliveredAt: '2026-07-19T11:59:03.000Z',
    attemptHistory: attempts('snd_1'),
  },
];

export const mockEvents: Paginated<EventDto> = {
  items: [
    {
      id: 'evt_1',
      source: 'stripe',
      type: 'payment_intent.succeeded',
      idempotencyKey: 'evt_stripe_001',
      status: 'processed',
      payload: { amount: 4200, currency: 'usd' },
      receivedAt: now,
      processedAt: '2026-07-19T12:00:01.000Z',
    },
    {
      id: 'evt_2',
      source: 'github',
      type: 'push',
      idempotencyKey: 'evt_github_002',
      status: 'failed',
      payload: { ref: 'refs/heads/main' },
      receivedAt: '2026-07-19T11:58:00.000Z',
      processedAt: null,
    },
  ],
  nextCursor: null,
  total: 2,
};

export function mockEventDetail(id: string): EventDetailDto {
  const base = mockEvents.items.find((e) => e.id === id) ?? mockEvents.items[0];
  return { ...base, id, sends: sendsWithAttempts };
}

const dlqSends: SendDto[] = [
  {
    id: 'snd_dlq_1',
    causedBy: 'evt_2',
    channel: 'email',
    to: 'ops@example.com',
    status: 'dead_lettered',
    attempts: 5,
    lastError: 'provider_timeout',
    createdAt: '2026-07-19T11:50:00.000Z',
    deliveredAt: null,
  },
  {
    id: 'snd_dlq_2',
    causedBy: 'evt_3',
    channel: 'sms',
    to: '+1 555 0142',
    status: 'dead_lettered',
    attempts: 5,
    lastError: 'invalid_recipient',
    createdAt: '2026-07-19T10:20:00.000Z',
    deliveredAt: null,
  },
  {
    id: 'snd_dlq_3',
    causedBy: 'evt_4',
    channel: 'webhook',
    to: 'https://hooks.partner.dev/inbound',
    status: 'dead_lettered',
    attempts: 5,
    lastError: 'connection_refused',
    createdAt: '2026-07-18T22:05:00.000Z',
    deliveredAt: null,
  },
];

export const mockSends: Paginated<SendDto> = {
  items: dlqSends,
  nextCursor: null,
  total: dlqSends.length,
};

const gaps: GapDto[] = [
  {
    id: 'gap_1',
    type: 'no_send',
    eventId: 'evt_2',
    sendId: null,
    detail: 'Processed event evt_2 has no send in a terminal state.',
    detectedAt: '2026-07-19T12:00:30.000Z',
    resolvedAt: null,
  },
];

export const mockReport: ReconcileReportDto = {
  gaps,
  summary: { no_send: 1, orphan_send: 0, duplicate_send: 0, stuck: 0, total: 1 },
  lastRunAt: '2026-07-19T12:00:30.000Z',
  invariantHolds: false,
};

export const mockStats: StatsDto = {
  eventsReceived: 1284,
  eventsProcessed: 1271,
  duplicatesRejected: 128,
  sendsDelivered: 1203,
  sendsInDlq: 6,
  openGaps: 1,
};
