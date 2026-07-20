# @conduit/sdk

Receive, deliver and reconcile every event — with proof.

You write three calls. The SDK and service own idempotency, retries, backoff, dead-lettering
and reconciliation.

```ts
import { Conduit, fromExpressRequest } from '@conduit/sdk';

const conduit = new Conduit({ baseUrl: 'http://localhost:3001' });

// 1. Receive — verified, idempotent, durable
const event = await conduit.handle(fromExpressRequest(req), {
  source: 'stripe',
  secret: process.env.STRIPE_WHSEC!,
});

// 2. React — reliable and idempotent by default
await conduit.send({
  type: 'email',
  to: user.email,
  template: 'receipt',
  data: { amount },
  causedBy: event.id, // links inbound → outbound for the reconciler
});

// 3. Prove — query the audit state any time
const report = await conduit.reconcile({ since: '2026-07-01' });
```

## Setup

```ts
const conduit = new Conduit({
  baseUrl: 'http://localhost:3001',
  timeoutMs: 10_000, // optional, per request
  fetch: myFetch,    // optional; defaults to global fetch (Node 18+)
});
```

> **Run the service with `AUTO_DELIVER=false`.** By default the service auto-sends for every
> event it receives, which is handy for demos but means an event would get *both* an
> automatic delivery and your explicit `send()` — two real messages. With the SDK, your code
> is what decides.

## `handle()`

Turns a route into a verified, idempotent, crash-safe intake.

The signature is checked **locally first**, so a forged payload is rejected without a network
call and never reaches the event log. The raw bytes are then forwarded untouched.

```ts
const { id, duplicate } = await conduit.handle(input, { source, secret });
```

`duplicate: true` means the provider re-delivered something already stored. You get the id of
the original, and no second effect is produced. That is the point — providers retry, and your
customer should still only be emailed once.

`secret` must match the service's `WEBHOOK_SECRET_<SOURCE>` env var.

### Getting the raw bytes

Signatures are computed over the **exact bytes received**. A body that your framework already
parsed and you re-serialise will not match — key order and whitespace are not preserved. This
is the single most common integration mistake, so both adapters fail loudly rather than
silently producing an unverifiable signature.

**Express** — mount the route with `express.raw()`:

```ts
import { fromExpressRequest } from '@conduit/sdk';

app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const event = await conduit.handle(fromExpressRequest(req), { source: 'stripe', secret });
  res.json(event);
});
```

**Fetch** (Next.js route handlers, Hono, Bun, Workers):

```ts
import { fromFetchRequest } from '@conduit/sdk';

export async function POST(request: Request) {
  const event = await conduit.handle(await fromFetchRequest(request), { source: 'stripe', secret });
  return Response.json(event);
}
```

**Anything else** — pass the bytes yourself:

```ts
await conduit.handle({ rawBody, signature }, { source: 'stripe', secret });
```

## `send()`

```ts
const send = await conduit.send({
  type: 'email',            // 'email' | 'sms'
  to: 'customer@acme.com',
  causedBy: event.id,       // required
  template: 'receipt',      // optional
  data: { amount: 4200 },   // optional
  idempotencyKey: `receipt:${event.id}`, // optional but recommended
});
```

Returns immediately once the send is durably recorded; delivery, retries and dead-lettering
happen in the background. Track it with `conduit.events.get(event.id)`.

**`causedBy` is required.** It is the thread the reconciler follows to prove every inbound
event produced its outbound effect. A send with no cause could never be reconciled, so the
API refuses to create one.

**Idempotency.** Call `send()` twice with the same `idempotencyKey` and you get the *original*
send back — not a second delivery. Omit the key and one is derived from the content, so even a
naive retry can't double-send. Enforced by a unique index, not a check, so it holds under
concurrency.

## `reconcile()`

```ts
const report = await conduit.reconcile({ since: '2026-07-01', status: 'open' });

report.summary.open      // gaps still outstanding
report.invariantHolds    // true when nothing is unaccounted for
report.lastRunAt         // null until the reconciler's first pass
report.gaps              // no_send | orphan_send | duplicate_send | stuck
```

`conduit.reconcileCsv(...)` returns the same report as CSV.

## Reading the log

Nothing is a black box.

```ts
await conduit.events.list({ status: 'processed', limit: 50 });
await conduit.events.get(id);                     // event + sends + every attempt
await conduit.sends.list({ status: 'dead_lettered' }); // the DLQ
await conduit.sends.replay(sendId);               // safe to call twice
await conduit.stats();
```

## Errors

```ts
import { ConduitError, ConduitSignatureError, ConduitTransportError } from '@conduit/sdk';

try {
  await conduit.send({ ... });
} catch (error) {
  if (error instanceof ConduitSignatureError) { /* forged webhook — reject with 401 */ }
  if (error instanceof ConduitError && error.retryable) { /* 5xx or 429 */ }
  if (error instanceof ConduitTransportError) { /* network failure or timeout */ }
}
```

`ConduitError` carries the API's envelope: `statusCode`, `code`, `message`, `details`. Branch
on `code` — it's stable; messages are not.

## Notes

- **No authentication yet.** The SDK takes a base URL and nothing else, matching the service.
  Don't expose Conduit publicly as-is.
- `template` and `data` are stored on the send and shown in the dashboard, but nothing renders
  them — templating is out of scope.
- The `webhook` channel is in the type union but has no provider yet; it falls back to email.
- Not published to npm. It's a workspace package; `@conduit/contracts` would need inlining first.
