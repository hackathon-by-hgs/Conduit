/**
 * Webhook signature scheme — HMAC-SHA256 over the exact raw body bytes, lowercase hex,
 * carried in the `x-signature` header.
 *
 * The implementation lives in `@conduit/sdk` and is re-exported here so the ingest service,
 * the webhook generator and every SDK consumer provably run the same code. A signing scheme
 * that drifts between client and server fails silently and looks like an auth bug, so there
 * is deliberately only one copy.
 *
 * It cannot live in `@conduit/contracts`: the web app imports that package, and `node:crypto`
 * would break the browser bundle.
 */
export { signPayload, verifyPayload } from '@conduit/sdk';
