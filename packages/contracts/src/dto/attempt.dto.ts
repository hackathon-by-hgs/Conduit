/** A single delivery attempt for a send. `nextRetryAt` lets the UI render the backoff gap. */
export interface AttemptDto {
  id: string;
  sendId: string;
  attemptNo: number;
  statusCode: number | null;
  error: string | null;
  /** Provider-side receipt (e.g. Resend message id) — present on a successful attempt. */
  providerId: string | null;
  durationMs: number;
  at: string;
  nextRetryAt: string | null;
}
