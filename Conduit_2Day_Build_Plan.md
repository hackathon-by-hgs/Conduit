# Conduit — 2-Day Build Plan

**4 developers · 2 backend, 2 frontend · monolithic repo**

Stack: NestJS + Next.js · PostgreSQL + Prisma · Redis + BullMQ · Resend (email) · SSE | Faith Popoola

## Read this first — the timeline is genuinely tight

Two days × 4 devs ≈ 8 developer-days, minus setup, integration, and merge friction. Every item below is tagged **P0** must ship (the demo breaks without it), **P1** should ship, **P2** cut first. If day two runs hot, cut by priority rather than letting four slices each finish half-done. The cut list on the last page gives the exact order.

## 0. Hour Zero — before anyone writes a feature (60–90 min, whole team)

Nothing below can start safely until these are done. In a shared monolith with four people, blocking is a bigger risk than slow coding — frontend cannot build against an API that doesn't exist, so the contract comes first.

1. **Repo scaffold** (you're handling this) — `apps/api` (NestJS), `apps/web` (Next.js), `packages/types`, docker-compose with Postgres + Redis.
2. **Freeze the API contract** — all four devs in one room, agree endpoints and payload shapes, commit `packages/types` FIRST. Frontend builds against these types immediately; backend fills them in.
3. **Commit the Prisma schema** (BE1 drives, 15 min) so nobody is blocked on migrations.
4. **Seed / mock generator** — a script that fires realistic webhooks at the API, so both FE devs get real-shaped data without waiting on BE.
5. **Branch rule** — one branch per dev, small PRs, merge to main at least every 3 hours. No long-lived branches on a 2-day clock.

### The frozen contract — commit this first

```ts
// packages/types/index.ts
export type EventStatus = 'received' | 'processing' | 'processed' | 'failed';
export type SendStatus = 'pending' | 'sent' | 'failed' | 'dead_lettered';
export type GapType = 'no_send' | 'orphan_send' | 'duplicate_send' | 'stuck';

export interface WebhookEvent {
  id: string; source: string; type: string;
  idempotencyKey: string; status: EventStatus;
  payload: unknown; receivedAt: string; processedAt?: string;
}

export interface Send {
  id: string; causedBy: string; // -> WebhookEvent.id
  channel: 'email' | 'sms' | 'webhook';
  to: string; status: SendStatus;
  attempts: number; lastError?: string;
  createdAt: string; deliveredAt?: string;
}

export interface Attempt {
  id: string; sendId: string; attemptNo: number;
  statusCode?: number; error?: string; durationMs: number; at: string;
}

export interface Gap { type: GapType; eventId?: string; sendId?: string; detail: string; detectedAt: string; }

export interface Paginated<T> { items: T[]; nextCursor?: string; total: number; }
```

### API endpoints

| Method | Path | Owner | Notes |
|---|---|---|---|
| POST | `/webhooks/:source` | BE1 | HMAC verify, dedupe, persist, enqueue |
| GET | `/events` | BE1 | cursor pagination, filter by status / source |
| GET | `/events/:id` | BE1 | includes its sends + attempts |
| GET | `/sends` | BE2 | filter by status (DLQ = dead_lettered) |
| POST | `/sends/:id/replay` | BE2 | re-enqueue a dead-lettered send |
| GET | `/reconcile` | BE2 | returns Gap[] + summary counts |
| GET | `/stream` | BE2 | SSE: pushes event / send status changes |
| GET | `/stats` | BE2 | counts for dashboard cards |

## Backend Developer 1 — Ingest, Persistence & Event API

**BACKEND 1**

Owns everything up to "the event is safely stored." Largest schema surface — unblocks everyone else.

### Day 1

- **P0** Prisma schema + migration — `WebhookEvent`, `Send`, `Attempt`, `ReconcileGap`. Indexes on `idempotencyKey` (unique), `status`, `receivedAt`, `causedBy`. (Do this in hour zero.)
- **P0** `POST /webhooks/:source` — accept, persist raw payload before any processing, return 200 fast.
- **P0** Idempotency dedupe — unique constraint on `idempotencyKey`; a duplicate returns 200 with the original event and never re-processes. This is the headline correctness guarantee.
- **P0** HMAC signature verification — per-source secret from env; reject invalid signatures with 401.
- **P1** Enqueue to BullMQ after persist — hand-off point to BE2; agree the job payload early.

### Day 2

- **P0** `GET /events` — cursor pagination, filters (status, source, date range).
- **P0** `GET /events/:id` — event with nested sends and attempts (what FE1's detail view renders).
- **P1** Validation + error handling — DTO validation, consistent error envelope, request logging.
- **P1** Seed / mock generator — realistic webhook traffic including deliberate duplicates (needed for the demo).
- **P2** Ordered processing per source key.
- **P2** Basic rate limiting on the ingest endpoint.

**Definition of done:** fire 1,000 webhooks with 10% duplicates → exactly the unique count is stored, duplicates return the original, and nothing is lost across an API restart.

## Backend Developer 2 — Delivery, Retry/DLQ, Reconciliation & SSE

**BACKEND 2**

Owns everything after "the event is stored." Highest-complexity slice — the reconciler is the product's differentiator.

### Day 1

- **P0** BullMQ worker — consumes enqueued events, creates `Send` rows with `causedBy` set.
- **P0** Real email delivery via Resend — API key in env; send and capture the provider response into an `Attempt`.
- **P0** Retry with exponential backoff + jitter — configurable max attempts; every attempt recorded.
- **P0** Dead-letter queue — after max attempts mark `dead_lettered`; never lose it.

### Day 2

- **P0** `POST /sends/:id/replay` — re-enqueue a dead-lettered send; idempotent so a double-click can't double-send.
- **P0** Reconciler job — scheduled (~30s). Checks the invariant: every processed event has ≥1 send in a terminal state. Emits gaps for `no_send`, `orphan_send`, `duplicate_send`, `stuck`.
- **P0** `GET /reconcile` — returns gaps plus summary counts.
- **P1** `GET /stream` (SSE) — pushes status changes. Keep it dumb: broadcast "something changed, refetch" rather than full diffing — far less risk.
- **P1** `GET /stats` and `GET /sends` (filterable; powers the DLQ view).
- **P2** SMS channel (log-only stub).
- **P2** Reconciliation export (CSV).

**Definition of done:** with the provider failing ~15% of sends, retries recover most, failures land in the DLQ, replay works, and an injected gap (delete a send) is flagged by the reconciler within one cycle.

## Frontend Developer 1 — App Shell, Event Stream & Event Detail

**FRONTEND 1**

Owns the primary "what's happening" surface. Start against `packages/types` + mock data in hour one — do not wait for the backend.

### Day 1

- **P0** App shell — Next.js layout, nav (Events / DLQ / Reconciliation), Tailwind setup, shared UI primitives (table, badge, card, empty / loading / error states). FE2 depends on these — ship by mid-morning day 1.
- **P0** Data layer — TanStack Query, typed API client from `packages/types`, mock adapter so every view works before the API lands.
- **P0** Events table — paginated list: source, type, status badge, received time, with cursor pagination.

### Day 2

- **P0** Event detail view — collapsible JSON payload viewer, the resulting sends, and the delivery timeline: each attempt with status, error, and backoff gap. This is the money screen for the demo.
- **P1** Filters — status, source, date range; URL-synced so state survives refresh.
- **P1** SSE subscription — connect to `/stream`, invalidate queries on change. Fall back to polling if SSE isn't ready — decide by 2pm day 2.
- **P2** Search by idempotency key.
- **P2** Copy-payload / re-send-from-detail actions.

**Definition of done:** with the seed script running, the events table updates live, and any event can be opened to see its full attempt-by-attempt delivery history.

## Frontend Developer 2 — DLQ, Reconciliation Dashboard & Stats

**FRONTEND 2**

Owns the "what went wrong and does it add up" surface — the views that make the reconciler visible, which is the whole differentiator.

### Day 1

- **P0** Stats cards — events received, sends delivered, in DLQ, open gaps (against mocks first).
- **P0** DLQ view — table of `dead_lettered` sends: cause, attempt count, last error, age.
- **P1** Replay action — per-row button with optimistic update and toast; guard against double-click.

### Day 2

- **P0** Reconciliation dashboard — gaps grouped by type (`no_send`, `orphan_send`, `duplicate_send`, `stuck`), each linking to the offending event or send. This section proves the thesis.
- **P0** Gap deep-linking — clicking a gap opens FE1's event detail view. Agree this route contract with FE1 on day 1.
- **P1** Bulk replay from the DLQ (multi-select).
- **P1** Health strip — reconciler last-run time and current invariant status (green / red).
- **P2** CSV export of the reconciliation report.
- **P2** Gap filtering by time window.

**Definition of done:** an injected failure appears in the DLQ and can be replayed to success, and an injected gap shows on the reconciliation dashboard and links through to its source event.

## Integration checkpoints — protect these

| When | Checkpoint |
|---|---|
| Day 1, hour 1 | Contract + types + schema committed; everyone unblocked |
| Day 1, midday | FE primitives merged (FE2 unblocked); ingest endpoint live |
| Day 1, end | End-to-end thin path works: webhook in → send attempted → visible in the UI. If this isn't true, cut P1/P2 tomorrow. |
| Day 2, midday | Reconciler emitting gaps; DLQ + replay working; SSE go / no-go decision |
| Day 2, −3 hours | Feature freeze. Only bug-fixes, seeding, and demo polish after this. |

## Cut list — in the exact order to cut

If you're behind, cut in this order. Each cut removes work without breaking the story:

1. All P2 items, immediately
2. SSE → fall back to polling every 3s
3. Bulk replay, CSV export, search
4. Filters (keep the status filter only)
5. Real email → mock provider that fails on a configurable percentage

The last thing to cut is the reconciler and its dashboard. Without it, Conduit is just another webhook logger. With it, the product thesis — reliable delivery end to end, with proof — is visible on screen.

## Demo script — what you show at the end

1. Start the seed generator — events stream into the table live.
2. Open an event → show the delivery timeline with retries and backoff gaps.
3. Point at the duplicate-webhook counter → processed once, not twice.
4. Show the DLQ → replay a failed send → watch it go green.
5. Open the reconciliation dashboard → an injected gap is flagged → click through to the source event.

That sequence demonstrates every P0 in under three minutes.

---

Conduit — 2-Day Build Plan · 4 developers · NestJS + Next.js monolith
