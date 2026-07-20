import {
  API_ROUTES,
  SIGNATURE_HEADER,
  type CreateSendRequest,
  type EventDetailDto,
  type EventDto,
  type GapFilter,
  type ListEventsQuery,
  type ListSendsQuery,
  type Paginated,
  type ReconcileReportDto,
  type SendDto,
  type StatsDto,
  type WebhookIngestResponse,
} from '@conduit/contracts';
import { ConduitSignatureError } from './errors';
import { Http } from './http';
import { signPayload, verifyPayload } from './signature';
import type { ConduitOptions, HandleInput, HandleOptions, SendInput } from './types';

const DEFAULT_TIMEOUT_MS = 10_000;

/** Options for `reconcile()`. `since` mirrors the spec; the API calls it `from`. */
export interface ReconcileOptions {
  since?: string;
  until?: string;
  status?: GapFilter;
}

/**
 * The Conduit client.
 *
 * ```ts
 * const conduit = new Conduit({ baseUrl: 'http://localhost:3001' });
 *
 * const event  = await conduit.handle(input, { source: 'stripe', secret });
 * const send   = await conduit.send({ type: 'email', to, causedBy: event.id });
 * const report = await conduit.reconcile({ since: '2026-07-01' });
 * ```
 */
export class Conduit {
  private readonly http: Http;

  constructor(options: ConduitOptions) {
    const fetchImpl = options.fetch ?? globalThis.fetch;
    if (typeof fetchImpl !== 'function') {
      throw new TypeError(
        'Conduit: no fetch implementation available. Use Node 18+ or pass `fetch` explicitly.',
      );
    }
    this.http = new Http({
      baseUrl: options.baseUrl,
      fetch: fetchImpl.bind(globalThis),
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    });
  }

  /**
   * Verify an inbound webhook and store it durably. One call turns a route into a verified,
   * idempotent, crash-safe intake.
   *
   * The signature is checked locally FIRST, so a forged payload is rejected without a
   * network round trip and never touches the event log. The raw bytes are then forwarded
   * untouched — re-serialising would invalidate the signature.
   *
   * Duplicates are safe: a provider re-delivering the same event gets `duplicate: true` and
   * the id of the original, and no second effect is produced.
   */
  async handle(input: HandleInput, options: HandleOptions): Promise<WebhookIngestResponse> {
    const { rawBody, signature } = input;

    if (!options.skipVerify) {
      if (!signature) {
        throw new ConduitSignatureError(options.source, `missing ${SIGNATURE_HEADER} header`);
      }
      if (!verifyPayload(options.secret, rawBody, signature)) {
        throw new ConduitSignatureError(options.source, 'signature did not match the body');
      }
    }

    return this.http.request<WebhookIngestResponse>(API_ROUTES.webhooks.ingest(options.source), {
      method: 'POST',
      rawBody,
      // Re-sign rather than forwarding blindly: with skipVerify the incoming header may be
      // absent or in a provider-specific format the service does not speak.
      headers: { [SIGNATURE_HEADER]: signature ?? signPayload(options.secret, rawBody) },
    });
  }

  /**
   * Send something as a consequence of an event. Retries, backoff, dead-lettering and replay
   * are the service's problem, not yours.
   *
   * Idempotent: call it twice with the same `idempotencyKey` — or the same content for the
   * same event — and the original send is returned rather than a second delivery.
   */
  send(input: SendInput): Promise<SendDto> {
    const body: CreateSendRequest = {
      channel: input.type,
      to: input.to,
      causedBy: input.causedBy,
      ...(input.template ? { template: input.template } : {}),
      ...(input.data ? { data: input.data } : {}),
      ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
    };
    return this.http.request<SendDto>(API_ROUTES.sends.create, { method: 'POST', body });
  }

  /** Ask whether every inbound event is accounted for by its outbound effects. */
  reconcile(options: ReconcileOptions = {}): Promise<ReconcileReportDto> {
    return this.http.request<ReconcileReportDto>(API_ROUTES.reconcile.report, {
      query: { from: options.since, to: options.until, status: options.status },
    });
  }

  /** The reconciliation report as CSV, for export or archiving. */
  reconcileCsv(options: ReconcileOptions = {}): Promise<string> {
    return this.http.request<string>(API_ROUTES.reconcile.exportCsv, {
      query: { from: options.since, to: options.until, status: options.status },
    });
  }

  readonly events = {
    list: (query: ListEventsQuery = {}): Promise<Paginated<EventDto>> =>
      this.http.request<Paginated<EventDto>>(API_ROUTES.events.list, { query }),

    /** An event with its sends and full attempt-by-attempt delivery history. */
    get: (id: string): Promise<EventDetailDto> =>
      this.http.request<EventDetailDto>(API_ROUTES.events.detail(id)),
  };

  readonly sends = {
    /** Pass `{ status: 'dead_lettered' }` for the dead-letter queue. */
    list: (query: ListSendsQuery = {}): Promise<Paginated<SendDto>> =>
      this.http.request<Paginated<SendDto>>(API_ROUTES.sends.list, { query }),

    /** Re-attempt a dead-lettered send. Safe to call twice — it will not double-send. */
    replay: (id: string): Promise<SendDto> =>
      this.http.request<SendDto>(API_ROUTES.sends.replay(id), { method: 'POST' }),
  };

  /** Dashboard counters: received, processed, duplicates rejected, delivered, DLQ, gaps. */
  stats(): Promise<StatsDto> {
    return this.http.request<StatsDto>(API_ROUTES.stats.get);
  }
}

/** Convenience factory, for callers who prefer not to write `new`. */
export function createConduit(options: ConduitOptions): Conduit {
  return new Conduit(options);
}
