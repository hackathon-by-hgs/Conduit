# Conduit

**The Event Reliability SDK — receive, deliver, and reconcile every event, with proof.**

Project specification & idea framing · Faith Popoola

Conduit is a single drop-in SDK and companion service that makes event-driven plumbing reliable end to end. It ingests inbound webhooks, processes them exactly once, sends the resulting outbound notifications (email, SMS, third-party webhooks), and continuously reconciles the two sides so a developer can prove no event was lost, duplicated, or silently dropped.

## The unifying thesis

Reliable delivery of events, end to end, with proof. The webhook handler and the sender are the two ends of one pipe; the reconciler is the audit layer that makes the pipe trustworthy. This is what turns three tools into one coherent product.

## 1. The Problem It Solves

Every product that talks to other systems rebuilds the same fragile plumbing: an endpoint that receives webhooks (from Stripe, Paystack, GitHub, a partner), logic that reacts to them, and outbound sends (a receipt email, an SMS, a webhook to yet another system). This plumbing fails in quiet, expensive ways:

- The same webhook arrives twice — providers retry — and the customer is emailed twice or charged twice.
- A webhook is received but the process crashes before finishing; the effect never happens and nobody notices.
- An outbound provider is briefly down and the notification is simply lost.
- Weeks later, nobody can answer "did every payment event actually send its receipt?"

Teams solve this ad-hoc, badly, once per project. Conduit is the reusable answer: drop in one SDK and inbound-to-outbound event flow becomes reliable and auditable, without rebuilding idempotency, retries, and reconciliation every time.

**Pitch:** "If you receive webhooks and send anything in response, you already need this."

## 2. What the SDK Does — three parts, one pipe

### INBOUND

**A · Webhook Handler**

Verifies HMAC signatures, reads/assigns an idempotency key so duplicates process once, persists the raw event durably before any work so a crash never loses it, with optional ordered processing per source.

### OUTBOUND

**B · Delivery / Sender**

A unified `send(email | sms | webhook)` API routed to providers, with retries (backoff + jitter), a dead-letter queue, one-click/CLI replay, and idempotent sends so a retry never double-delivers.

### AUDIT

**C · Reconciler**

Links every inbound event to the outbound effects it should have produced, and continuously checks the invariant: every processed inbound event has its expected outbound send in a terminal state (delivered or explicitly dead-lettered) — nothing stuck, lost, or duplicated. It surfaces gaps (received-but-no-send, send-without-source, duplicate sends) immediately rather than at month-end, and produces an exportable reconciliation report.

## 3. How It's Integrated — the SDK surface

```js
// 1. Receive: one line turns any route into a verified, idempotent, durable intake
conduit.handle(req, { source: "stripe", secret: STRIPE_WHSEC });

// 2. React + send: outbound is reliable and idempotent by default
await conduit.send({
  type: "email", to: user.email, template: "receipt",
  data: { amount },
  causedBy: event.id, // links inbound → outbound for the reconciler
});

// 3. Prove: query reconciliation state any time
const report = await conduit.reconcile({ since: "2026-07-01" });
```

The developer never writes idempotency, retry, backoff, DLQ, or reconciliation logic — the SDK owns it. The `causedBy` field is the thread that lets the reconciler tie the two ends together.

## 4. Architecture

```
        inbound webhook                                              outbound
              │                                                         ▲
              ▼                                                         │
        ┌───────────┐   persist    ┌────────────┐  send + retry   ┌──────────┐
        │  Handler  │─────────────▶│  event_log │────────────────▶│ Delivery │──▶ email / SMS /
        │ verify +  │              │  (durable) │◀── status ──────│  + DLQ   │        webhook
        │ idempotent│              └─────┬──────┘                 └──────────┘
        └───────────┘                    │
                                         ▼
                                 ┌──────────────┐
                                 │  Reconciler  │  inbound ↔ outbound invariant,
                                 │   (audit)    │  gap detection, report / export
                                 └──────────────┘
```

`event_log` (Postgres) is the source of truth — inbound events, outbound sends, their `causedBy` links and statuses. A delivery queue (Redis / BullMQ) drives retries with backoff + jitter and dead-lettering. The reconciler runs continuously, reducing the log to "is every side accounted for?"

**Stack:** NestJS (or Go for the service), PostgreSQL, Redis + BullMQ, provider SDKs (SendGrid / Twilio), published as an npm SDK plus a small self-hostable service, with a thin dashboard for the live event stream, DLQ, and reconciliation gaps.

## 5. SDK Design Philosophy — clean to call, transparent to verify

What makes an SDK a "go-to" — one developers reach for instead of the raw API — comes down to two proven, opposite playbooks. Conduit deliberately borrows from both.

| Model | What they won on | The lesson for Conduit |
|---|---|---|
| Stripe / Resend | Magic: one clean function call hides all the messy internals (idempotency, retries, delivery) | Integration must be one line. Resend beat SendGrid in a "solved" market purely on SDK/DX — same capability, dramatically better feel. |
| Drizzle | Transparency: a thin, un-magical layer where you see exactly what runs, with no heavy runtime and no lock-in | For a reliability product you sell trust. Let a skeptical developer inspect the event log and reconciliation, not just trust a black box. |

**Conduit's chosen lane: Stripe-clean to call, Drizzle-transparent to inspect.**

One-line integration and idempotent-by-default sends (the magic), but the reliability and reconciliation state is fully visible, queryable, and controllable — never a black box. For anything touching money, audit, or correctness, developers distrust magic; letting them verify the guarantee is the wedge.

## 6. Before / After — the defensible metric

Before: a naive receiver that processes every webhook and fires sends inline — no idempotency, no retry, no reconciliation. After: Conduit in front. Test: N events with injected duplicates, ~15% provider failures, and a mid-processing crash.

| Metric | Naive baseline | With Conduit (target) |
|---|---|---|
| Duplicate outbound sends | occurs on every retry | 0 (idempotency) |
| Events received but not acted on | lost on crash | 0 (durable log) |
| Failed sends recovered | lost | 100% via DLQ replay |
| Injected reconciliation gaps caught | undetected | 100% |

Numbers are illustrative targets — the real figures come from the reproducible harness, so they are defensible in an interview.

## 7. What Each CV Gets · Scope · Origin

**Backend**

At-least-once + idempotent processing, retry / backoff / DLQ, durable event log, provider abstraction, the reconciliation invariant, HMAC verification.

**Frontend**

Live event-stream dashboard, DLQ + replay UI, reconciliation gap explorer, delivery timelines.

**Scope guardrails.** In scope: the three parts, the SDK surface, one dashboard, the harness. Out of scope (README roadmap): multi-tenant billing, a template-design studio, marketing-campaign tooling, analytics. Keeping the reconciler as the audit layer — not a general BI tool — is what keeps this one coherent product rather than three.

**Origin.** Conduit merges three earlier concepts into one: Sentinel (webhook idempotency / reliability), Notifly (multi-channel / email delivery), and SettleWise (reconciliation), unified under "reliable event delivery, end to end, with proof."

---

Conduit — Event Reliability SDK · Project Specification & Idea Framing
