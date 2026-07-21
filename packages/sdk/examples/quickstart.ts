/**
 * End-to-end proof that the SDK works against a running Conduit service.
 *
 *   docker compose up -d
 *   RESEND_API_KEY= AUTO_DELIVER=false pnpm --filter @conduit/api start:prod
 *   pnpm --filter @conduit/sdk example
 *
 * AUTO_DELIVER=false matters: it turns off auto-pilot so THIS script decides what gets sent,
 * which is the whole point of the SDK. Leaving it on would also produce an automatic
 * delivery per event, on top of the explicit one below.
 */
import { Conduit, signPayload } from '../src';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const SOURCE = 'stripe';
const SECRET = process.env.WEBHOOK_SECRET_STRIPE ?? 'whsec_replace_me';

// The key is a server-side secret. Omit it only when the service runs with CONDUIT_API_KEY
// unset (local development), which is the one case where auth is disabled.
const conduit = new Conduit({ baseUrl: BASE_URL, apiKey: process.env.CONDUIT_API_KEY });

function step(n: number, title: string): void {
  console.log(`\n${n}. ${title}`);
}

async function main(): Promise<void> {
  console.log(`Conduit SDK quickstart → ${BASE_URL}`);

  // 1. Receive. In a real app these bytes come off your webhook route; here we forge a
  //    Stripe-shaped payload and sign it the way the provider would.
  step(1, 'handle() — verify and durably store an inbound webhook');
  const rawBody = Buffer.from(
    JSON.stringify({
      id: `evt_quickstart_${Date.now()}`,
      type: 'invoice.paid',
      amount: 4200,
      currency: 'usd',
    }),
  );
  const signature = signPayload(SECRET, rawBody);

  const event = await conduit.handle({ rawBody, signature }, { source: SOURCE, secret: SECRET });
  console.log(`   stored event ${event.id} (duplicate: ${event.duplicate})`);

  // 2. React. Your business logic decides what should happen because of that event.
  step(2, 'send() — one reliable, idempotent outbound send');
  const send = await conduit.send({
    type: 'email',
    to: 'customer@example.com',
    template: 'receipt',
    data: { amount: 4200 },
    causedBy: event.id,
    idempotencyKey: `receipt:${event.id}`,
  });
  console.log(`   created send ${send.id} → ${send.to} (${send.status})`);

  // 3. The guarantee: a retried send must NOT deliver twice.
  step(3, 'send() again with the same key — must return the SAME send');
  const retried = await conduit.send({
    type: 'email',
    to: 'customer@example.com',
    template: 'receipt',
    data: { amount: 4200 },
    causedBy: event.id,
    idempotencyKey: `receipt:${event.id}`,
  });
  const idempotent = retried.id === send.id;
  console.log(`   got send ${retried.id} — ${idempotent ? 'SAME ✓' : 'DIFFERENT ✗'}`);

  // 4. Inspect. Nothing is a black box: the full delivery history is queryable.
  step(4, 'events.get() — the event with its sends and attempt history');
  const detail = await conduit.events.get(event.id);
  console.log(`   ${detail.sends.length} send(s); status ${detail.status}`);

  // 5. Prove. The reconciler's answer to "does every side add up?"
  step(5, 'reconcile() — the audit report');
  const report = await conduit.reconcile();
  console.log(
    `   open gaps: ${report.summary.open} | invariant holds: ${report.invariantHolds}` +
      ` | last run: ${report.lastRunAt ?? 'not yet run'}`,
  );

  const stats = await conduit.stats();
  console.log(`   stats: ${JSON.stringify(stats)}`);

  if (!idempotent) {
    throw new Error('Idempotency check FAILED — the same key produced two different sends.');
  }
  console.log('\n✓ PASS — handle, send (idempotent), inspect and reconcile all work.');
}

main().catch((error: unknown) => {
  console.error('\n✗ FAILED:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
