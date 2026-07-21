/** Header carrying the HMAC signature over the raw request body (Conduit's generic scheme). */
export const SIGNATURE_HEADER = 'x-signature';

/**
 * Monnify signs its transaction notifications with SHA-512 and carries the digest in its own
 * header, so `monnify` ingest reads this one instead of {@link SIGNATURE_HEADER}.
 */
export const MONNIFY_SIGNATURE_HEADER = 'monnify-signature';

/** Response of POST /webhooks/:source. */
export interface WebhookIngestResponse {
  id: string;
  duplicate: boolean;
}
