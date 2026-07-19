/** Payload enqueued after a webhook event is persisted — the BE1 → BE2 hand-off. */
export interface DeliveryJobData {
  eventId: string;
  /** Ordering key — jobs for the same source are processed in FIFO order. */
  source: string;
  /** ISO receive time, so the worker can order per source. */
  receivedAt: string;
}

export const DELIVERY_JOB_NAME = 'deliver';
