/**
 * Service authentication (single source of truth for client and server).
 *
 * Conduit is a machine-to-machine service: a single shared key, sent on every request, with
 * no user accounts or sessions. Two routes are deliberately exempt:
 *
 * - `POST /webhooks/:source` — providers like Stripe cannot send our key. That endpoint is
 *   authenticated by its per-source HMAC signature instead, which is stronger: it proves the
 *   payload is untampered, not merely that the caller knows a secret.
 * - `GET /health` — liveness probes must work without credentials.
 */

/** Preferred header: `Authorization: Bearer <key>`. */
export const AUTH_HEADER = 'authorization';
export const AUTH_SCHEME = 'Bearer';

/** Accepted alternative for clients that reserve `Authorization` for something else. */
export const API_KEY_HEADER = 'x-api-key';

/** Error code returned when the key is missing or wrong. */
export const UNAUTHORIZED_CODE = 'UNAUTHORIZED';

/** Build the `Authorization` header value for a key. */
export function bearer(apiKey: string): string {
  return `${AUTH_SCHEME} ${apiKey}`;
}
