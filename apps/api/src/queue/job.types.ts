/** Payload enqueued after a webhook event is persisted — the BE1 → BE2 hand-off. */
export interface DeliveryJobData {
  eventId: string;
  /** Ordering key — jobs for the same source are processed in FIFO order. */
  source: string;
  /** ISO receive time, so the worker can order per source. */
  receivedAt: string;
  /**
   * Set when the send row already exists — i.e. an explicit `POST /sends` (the SDK path).
   * The worker then delivers THAT row rather than deriving a new send from the event.
   * Absent for the auto-pilot path, where the worker creates the send itself.
   */
  sendId?: string;
}

export const DELIVERY_JOB_NAME = 'deliver';
