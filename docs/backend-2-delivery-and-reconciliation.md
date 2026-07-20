# Backend 2 — Delivery, Retry/DLQ, Reconciliation & SSE

Everything after *"the event is stored."* This is the half of the pipe that turns a durable
inbound log into outbound effects, and then proves the two sides add up.

> **Owner:** Backend 2 · **Upstream hand-off:** BE1 writes a `WebhookEvent` + an `OutboxJob`
> in one transaction; the dispatcher drains it to BullMQ. Everything below starts there.

---

## 1. Delivery pipeline

```
outbox row ──▶ BullMQ ──▶ DeliveryProcessor ──▶ DeliveryService.processDelivery
                                                        │
                        ┌───────────────────────────────┤
                        ▼                               ▼
                 ensureSend (idempotent)        ResendProvider.send
                        │                               │
                        └──────────▶ recordAttempt ◀────┘
                                          │
                        sent ─────────────┼───────────── dead_lettered
                                       retry
                                          │
                                  throw → BullMQ re-delivers after jittered backoff
```

### Idempotency, at three layers

Delivery is safe to re-run — which matters because BullMQ is at-least-once and a worker can
die mid-flight.

| Layer | Mechanism | Prevents |
|---|---|---|
| Queue | `jobId` = outbox row id | Double-enqueue after a crash/redispatch |
| Event → send | `ensureSend` finds an existing send for `causedBy` | A re-delivered job creating a second send |
| Content | `dedupeKey` = `sha256(channel + to + payload)` within `DELIVERY_DEDUP_WINDOW_MS` | Two *different* events emailing the same thing to the same person |

`ensureSend` serialises per source with a **single** Postgres advisory lock
(`pg_advisory_xact_lock(hashtext(source))`). One lock per job means no lock ordering, so no
deadlock, while different sources still proceed in parallel.

### Channels

`ChannelRouter` picks a provider from the payload's `channel` field (default `email`) and
the recipient from `to`. Everything downstream — attempts, backoff, DLQ, replay,
reconciliation — is channel-agnostic, so a new channel is one `DeliveryProvider` plus one
line in the router.

| Channel | Provider | Status |
|---|---|---|
| `email` | `ResendProvider` | Live (or simulated without a key) |
| `sms` | `SmsProvider` | **Log-only stub** (P2) — validates E.164, logs, never sends |
| `webhook` | — | Not implemented; falls back to email with a warning |

An unknown channel degrades to email rather than failing: the event is already durably
stored, and dropping it would violate the product's whole premise.

The SMS stub is deliberately *not* a no-op that always succeeds. It validates the recipient
and honours `DELIVERY_FAIL_RATE`, so an SMS send exercises the same retry/DLQ/replay paths
as email — which is what proves the reliability machinery is genuinely channel-agnostic
rather than email-shaped. A bad number returns `retryable: false` and dead-letters on the
first attempt instead of burning the budget.

### Provider: live vs simulated

`ResendProvider` has one code path and two modes, chosen by whether `RESEND_API_KEY` is a
real `re_...` key:

- **LIVE** — performs the real Resend call and captures the true response. The message id
  lands in `Attempt.providerId`, which is the receipt that makes a delivery claim
  *verifiable against the provider* rather than merely asserted.
- **SIMULATED** — no network call, no mail. Retry → backoff → DLQ → replay behave
  identically, so the whole story is demonstrable offline.

The mode is logged at boot. `DELIVERY_FAIL_RATE` injects synthetic failures in **both**
modes — that is how the spec's *"provider fails ~15% of sends"* harness is reproduced
without actually breaking real email.

**Failures are classified, not just counted.** A `retryable: false` result (bad recipient,
rejected key, 4xx that isn't 408/429) dead-letters immediately instead of burning the whole
attempt budget on something that can never succeed. Transport errors — where the provider
was never reached — are always retryable.

### Retry: exponential backoff with *deterministic* jitter

`src/common/retry/backoff.ts`. Delay lands in **[50%, 100%]** of an exponential ceiling
(`base · 2^(n-1)`, capped at `DELIVERY_BACKOFF_CAP_MS`) — "equal jitter", so the curve stays
monotonic and a late attempt can never collapse back to ~0.

The jitter is derived from `sha256(eventId + ":" + attemptNo)` rather than `Math.random()`.
That is deliberate:

- it still **decorrelates** retries, which is the entire point of jitter — a thousand sends
  failing at the same instant get a thousand different delays;
- but it is **reproducible**, so BullMQ's backoff strategy and the `Attempt.nextRetryAt` the
  worker persists derive the *same* number. The backoff gap the dashboard renders is the
  schedule the queue actually follows, not an unrelated estimate of it.

> BullMQ resolves a named backoff strategy from the **worker's** `settings`, not the queue's
> — see `jitteredBackoffSettings()` in `queue.module.ts`, applied via `@Processor`.

### The attempt budget (and the replay bug it fixes)

`Send.attemptBudget` is seeded from `DELIVERY_MAX_ATTEMPTS` at creation, and
`recordAttempt` reads the budget **from the row** rather than from config.

This exists because of a real bug: replay used to reset `status` to `pending` but leave
`attempts` at the max. The next failure evaluated `attemptNo < maxAttempts` as false and
dead-lettered instantly, so **a replayed send got zero real retries** — with a non-zero
failure rate, "replay it and watch it go green" was a coin flip.

Replay now *extends* the budget by `DELIVERY_MAX_ATTEMPTS` instead of resetting `attempts`.
Attempt numbers stay monotonic and the full history survives:

```
attemptNo | statusCode | providerId     | error                  | nextRetryAt
----------+------------+----------------+------------------------+-------------
        1 |        502 |                | provider_unavailable   | 23:57:17.880
        2 |        502 |                | provider_unavailable   | 23:57:18.372
        3 |        502 |                | provider_unavailable   |              ← gave up → DLQ
        4 |        502 |                | provider_unavailable   | 23:57:50.511 ← replay: retries
        5 |        202 | sim_ovxthivyml |                        |              ← delivered
```

### Replay is double-click safe

`claimForReplay` locks the row `FOR UPDATE` and only acts on a `dead_lettered` send; any
other status is a no-op. Two concurrent replays produce exactly one reset and exactly one
budget extension.

---

## 2. The reconciler

The differentiator. It answers *"does every side add up?"* continuously, not at month-end.

**The invariant:** every `processed` inbound event has ≥1 outbound send in a terminal state
(`sent` or `dead_lettered`) — nothing stuck, lost, or duplicated.

### Level-triggered, not edge-triggered

Each pass recomputes the **current violation set** from the log, then diffs it against the
stored open gaps in *both* directions:

- a violation with no open gap → **emit** a gap
- an open gap with no violation → **resolve** it (`resolvedAt`)

Because the output depends only on the present state of the log, a missed run, a restart, or
a duplicated run all converge on the same answer. This is what lets the dashboard show the
invariant returning to **green** after a repair — previously gaps were immortal and the
health strip could only ever get worse.

Resolved gaps are retained as audit history rather than deleted.

### The four gap types

| Type | Detected when |
|---|---|
| `no_send` | A `processed` event has no send in a terminal state |
| `orphan_send` | A terminal send whose event is **not** marked `processed` — an outbound effect with no settled inbound cause |
| `duplicate_send` | An event with more than one `sent` send |
| `stuck` | A send non-terminal for longer than 5 minutes |

*(A send whose event row is gone cannot occur — `Send.causedBy` cascades on delete.)*

### Two things that are NOT gaps

A gap has to mean "this is genuinely unaccounted for". Two situations look like violations
but aren't, and reporting them made the dashboard noisy enough to devalue the real ones:

1. **A delivery still in flight.** An event is marked `processed` the instant its send row
   is created, so between creation and a terminal outcome it is briefly "processed with no
   terminal send". Every single in-flight delivery was being flagged and then resolving
   itself seconds later. `RECONCILE_NO_SEND_GRACE_MS` (default 60s) excludes them. A healthy
   300-event run now emits **zero** gaps; before the fix the same run produced a stream of
   self-resolving `no_send` noise.
2. **A deliberately collapsed duplicate.** Near-duplicate dedupe folds one event's delivery
   into an earlier identical send, leaving that event `processed` with no send of its own —
   correct behaviour, but previously reported as a *permanent* `no_send` gap that could
   never resolve. `WebhookEvent.collapsedInto` records which send absorbed it, so the
   reconciler can tell "accounted for elsewhere" from "missing", and the exemption is
   auditable rather than silent.

### Concurrency safety

Emission is deduped in the database by a partial unique index on **open** gaps
(`reconcile_gaps_open_unique` on `(type, eventId, sendId) WHERE resolvedAt IS NULL`,
`NULLS NOT DISTINCT`), so multiple API instances reconciling at once cannot double-emit. The
in-process pass is additionally non-reentrant.

`lastRunAt` is the timestamp of the last **completed** pass, or `null` if the reconciler has
not run since boot — a stale value is a real signal that it is wedged. (It previously
returned `new Date()` unconditionally, which could never be stale and therefore never told
you anything.)

---

## 3. Read APIs

| Endpoint | Notes |
|---|---|
| `GET /sends` | Cursor-paginated, `status` filter. DLQ view = `?status=dead_lettered`. |
| `POST /sends/:id/replay` | Idempotent; returns the send. |
| `GET /reconcile` | `?from`/`?to` (ISO-8601) and `?status=all\|open\|resolved`. Returns gaps, a per-type summary with an `open`/`resolved` split, `lastRunAt`, and `invariantHolds`. |
| `GET /reconcile/export.csv` | The exportable report. Honours the same filters, so what you export is what the dashboard shows. RFC 4180 quoting, and cells starting `=`/`+`/`-`/`@` are neutralised against spreadsheet formula injection. |
| `GET /stats` | All six counts in **one transaction**, so the dashboard cards are a consistent snapshot rather than reads either side of a concurrent write. |
| `GET /stream` | SSE. Deliberately dumb: broadcasts *"something changed, refetch"*. `gap.detected` carries `gapId: null` when a pass changed several gaps at once, which is the normal case. |

`duplicatesRejected` is a **real measurement**: every re-delivery rejected by the idempotency
constraint atomically increments `duplicateCount` on the original event, and `/stats` sums
them. It used to be hardcoded `0`, which made the demo's headline correctness claim
unfalsifiable.

---

## 4. Verification

### Test suites

```bash
pnpm --filter @conduit/api test        # unit — backoff maths, signatures, mappers
pnpm --filter @conduit/api test:int    # integration — against a live Postgres
```

Integration coverage owned by this slice:

- `delivery.int.spec.ts` — idempotent `ensureSend` under concurrency, dedupe window,
  failure escalation to DLQ, provider receipt capture, non-retryable short-circuit,
  double-click replay, and the **replayed-budget regression**.
- `reconciler.int.spec.ts` — critical test #2 (delete a send → `no_send` flagged exactly
  once), `orphan_send`, gap resolution after repair, and no-reopen-after-resolve.
- `stats.int.spec.ts` — `duplicatesRejected` counts concurrent re-deliveries without losing
  increments.
- `gap-uniqueness.int.spec.ts` — concurrent identical open gaps collapse to one row.

> `test/` is included in `tsconfig.json`. It previously was not, which is how a test calling
> a two-argument constructor with one argument stayed green.

### End-to-end result

300 webhooks · 10% duplicates · 35% injected failure rate · `DELIVERY_MAX_ATTEMPTS=3`:

```json
{ "eventsReceived": 277, "eventsProcessed": 277, "duplicatesRejected": 23,
  "sendsDelivered": 262, "sendsInDlq": 15, "openGaps": 0 }
```

- 262 + 15 = 277 — **every event accounted for**, nothing lost.
- 23 duplicates fired, 23 rejected, 277 unique stored — exact.
- A DLQ send replayed to `sent` (timeline above).
- A gap injected by deleting a send was flagged within one cycle, then **auto-resolved**
  once repaired, with `invariantHolds` returning to `true`.

Reproduce it:

```bash
docker compose up -d
pnpm --filter @conduit/api db:migrate:deploy

# SIMULATED mode — no real email is sent.
RESEND_API_KEY='' DELIVERY_FAIL_RATE=0.35 DELIVERY_MAX_ATTEMPTS=3 \
  RECONCILE_INTERVAL_MS=5000 pnpm --filter @conduit/api start:prod

pnpm --filter @conduit/api webhooks:generate -- --count 300 --dup-rate 0.1
```

> ⚠️ Set `RESEND_API_KEY=''` for load testing. With a real key the provider is LIVE and the
> generator's synthetic recipients become real send attempts against your Resend quota.

---

## 5. Configuration

| Variable | Default | Purpose |
|---|---|---|
| `DELIVERY_MAX_ATTEMPTS` | `5` | Attempt budget per send; replay grants another full budget |
| `DELIVERY_BACKOFF_MS` | `1000` | Base of the exponential backoff |
| `DELIVERY_BACKOFF_CAP_MS` | `60000` | Ceiling, so a long retry chain can't schedule hours out |
| `DELIVERY_DEDUP_WINDOW_MS` | `1000` | Window for collapsing same-content sends |
| `DELIVERY_FAIL_RATE` | `0` | Injected failure rate `[0,1]` for the harness (applies to email *and* SMS) |
| `RECONCILE_INTERVAL_MS` | `30000` | Reconciler cadence |
| `RECONCILE_NO_SEND_GRACE_MS` | `60000` | Grace before a processed-but-undelivered event is a `no_send` gap |
| `RECONCILE_STUCK_AFTER_MS` | `300000` | How long a send may stay non-terminal before it is `stuck` |
| `RESEND_API_KEY` | — | Real `re_...` key ⇒ LIVE mode; absent/placeholder ⇒ SIMULATED |

---

## 6. Known limits / next

- **`webhook` is the one unimplemented channel** — it is a valid `Channel` in the contract
  but has no provider, so it falls back to email. Email is live; SMS is a log-only stub.
- SMS is a stub by design (P2). Going live means replacing `SmsProvider.deliver()` and
  nothing else.
- The reconciler scans the full table each pass. Fine at demo scale; a production version
  would window by `receivedAt` and index accordingly.
- `KeyedSerializer` (per-source in-process ordering) assumes a single worker instance. A
  multi-instance deployment would need a Redis-backed lock — the per-source advisory lock in
  `ensureSend` already covers the correctness-critical part across instances.
- The backoff strategy reads its two tunables from `process.env` rather than
  `AppConfigService`, because `@Processor` takes a static options object. `env.schema.ts`
  remains their single definition; the fallbacks only mirror its defaults.
