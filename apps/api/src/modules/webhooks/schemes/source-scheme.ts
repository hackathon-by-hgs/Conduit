/**
 * Per-source ingest schemes.
 *
 * Every provider signs and shapes its webhooks differently: the header name, the hash
 * algorithm, and where the unique reference lives in the body all vary. Conduit keeps ONE
 * ingest path and swaps the source-specific parts behind this interface, so adding a provider
 * is a new `SourceScheme` rather than another branch in `WebhooksService`.
 */

/** The two fields ingest needs out of a body, whatever shape the provider sends. */
export interface ParsedEvent {
  /** The provider's event type, e.g. `SUCCESSFUL_TRANSACTION`. `unknown` if absent. */
  type: string;
  /** The provider's unique reference for this event. `undefined` → ingest rejects with 400. */
  idempotencyKey: string | undefined;
}

export interface SourceScheme {
  /** Header this provider carries its signature in. */
  readonly signatureHeader: string;
  /** Verify the signature over the EXACT raw bytes — never a re-serialised body. */
  verify(secret: string, rawBody: Buffer, signature: string): boolean;
  /** Pull the event type and idempotency key out of the parsed body. */
  parse(body: Record<string, unknown>): ParsedEvent;
}
