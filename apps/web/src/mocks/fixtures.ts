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
    providerId: null,
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
    // Provider receipt for the successful attempt — proof the delivery really happened.
    providerId: 're_2Kd9xQmT4bLn',
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

// Ordered newest-first, as the events list is served.
export const eventList: EventDto[] = [
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
  {
    id: 'evt_3',
    source: 'stripe',
    type: 'charge.refunded',
    idempotencyKey: 'evt_stripe_003',
    status: 'processed',
    payload: { amount: 1500, currency: 'usd' },
    receivedAt: '2026-07-19T11:45:00.000Z',
    processedAt: '2026-07-19T11:45:02.000Z',
  },
  {
    id: 'evt_4',
    source: 'shopify',
    type: 'orders/create',
    idempotencyKey: 'evt_shopify_004',
    status: 'processing',
    payload: { orderId: 'A1043', total: 89.9 },
    receivedAt: '2026-07-19T11:30:00.000Z',
    processedAt: null,
  },
  {
    id: 'evt_5',
    source: 'github',
    type: 'pull_request.opened',
    idempotencyKey: 'evt_github_005',
    status: 'processed',
    payload: { number: 218 },
    receivedAt: '2026-07-19T10:15:00.000Z',
    processedAt: '2026-07-19T10:15:01.000Z',
  },
  {
    id: 'evt_6',
    source: 'stripe',
    type: 'invoice.payment_failed',
    idempotencyKey: 'evt_stripe_006',
    status: 'received',
    payload: { invoice: 'in_88231' },
    receivedAt: '2026-07-19T09:05:00.000Z',
    processedAt: null,
  },
];

export const mockEvents: Paginated<EventDto> = {
  items: eventList,
  nextCursor: null,
  total: eventList.length,
};

export function mockEventDetail(id: string): EventDetailDto {
  const base = eventList.find((e) => e.id === id) ?? eventList[0];
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
    detail: 'Processed event evt_2 produced no send.',
    detectedAt: '2026-07-19T12:00:30.000Z',
    resolvedAt: null,
  },
  {
    id: 'gap_2',
    type: 'duplicate_send',
    eventId: 'evt_1',
    sendId: 'snd_1',
    detail: 'Event evt_1 has two delivered sends to the same recipient.',
    detectedAt: '2026-07-19T12:00:30.000Z',
    resolvedAt: null,
  },
  {
    id: 'gap_3',
    type: 'orphan_send',
    eventId: null,
    sendId: 'snd_orphan_9',
    detail: 'Send snd_orphan_9 has no source event.',
    detectedAt: '2026-07-19T12:00:30.000Z',
    resolvedAt: null,
  },
  {
    id: 'gap_4',
    type: 'stuck',
    eventId: 'evt_5',
    sendId: 'snd_stuck_5',
    detail: 'Send snd_stuck_5 has been pending for over an hour.',
    detectedAt: '2026-07-19T12:00:30.000Z',
    resolvedAt: null,
  },
];

export const mockReport: ReconcileReportDto = {
  gaps,
  summary: {
    no_send: 1,
    orphan_send: 0,
    duplicate_send: 0,
    stuck: 0,
    total: 1,
    open: 1,
    resolved: 0,
  },
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
