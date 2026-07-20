import { z } from 'zod';
import { CHANNEL, SEND_STATUS } from '../enums';

/** Query params for GET /sends (DLQ view filters on status = 'dead_lettered'). */
export const listSendsQuerySchema = z.object({
  status: z.enum(SEND_STATUS).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type ListSendsQuery = z.infer<typeof listSendsQuerySchema>;

/**
 * Body for POST /sends — an explicit outbound send, the endpoint behind `conduit.send()`.
 *
 * `causedBy` is required and must reference a stored event: it is the thread the reconciler
 * follows to prove every inbound event produced its outbound effect. A send with no cause
 * could never be reconciled, so the API refuses to create one.
 */
export const createSendSchema = z.object({
  channel: z.enum(CHANNEL),
  to: z.string().min(1),
  /** → EventDto.id. The inbound event this send is a consequence of. */
  causedBy: z.string().min(1),
  /** Template name. Stored on the send payload; nothing renders it (out of scope). */
  template: z.string().min(1).optional(),
  /** Arbitrary template data, stored on the send payload. */
  data: z.record(z.string(), z.unknown()).optional(),
  /**
   * Exactly-once key. Repeat a call with the same key and the ORIGINAL send is returned
   * rather than a second delivery. Derived from the send's content when omitted.
   */
  idempotencyKey: z.string().min(1).max(255).optional(),
});

export type CreateSendRequest = z.infer<typeof createSendSchema>;
