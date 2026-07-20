/**
 * Webhook mock generator — fires realistic, HMAC-signed webhooks at the RUNNING API,
 * including deliberate duplicates. Unblocks the FE devs (real-shaped data through the real
 * API) and doubles as the BE1 Definition-of-Done check.
 *
 * Run:
 *   pnpm --filter @conduit/api webhooks:generate -- --count 1000 --dup-rate 0.1
 *   pnpm --filter @conduit/api webhooks:stream            # continuous, for the live demo
 *
 * Flags: --count N  --dup-rate 0..1  --sources stripe,github,slack  --rps N
 *        --stream    --api http://localhost:3001
 *
 * DoD (burst mode): asserts the server returned duplicate:false for exactly the uniques it
 * sent and duplicate:true for exactly the duplicates → "exactly the unique count is stored,
 * duplicates return the original." Prints PASS/FAIL.
 */
import { randomUUID } from 'node:crypto';
import { API_ROUTES, SIGNATURE_HEADER } from '@conduit/contracts';
import { signPayload } from '../src/common/crypto/signature';

interface Args {
  count: number;
  dupRate: number;
  sources: string[];
  rps: number;
  stream: boolean;
  api: string;
}

function parseArgs(argv: string[]): Args {
  const get = (name: string): string | undefined => {
    const eq = argv.find((a) => a.startsWith(`--${name}=`));
    if (eq) return eq.split('=').slice(1).join('=');
    const i = argv.indexOf(`--${name}`);
    if (i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[i + 1];
    return undefined;
  };
  const has = (name: string): boolean => argv.includes(`--${name}`);

  return {
    count: Number(get('count') ?? 50),
    dupRate: Number(get('dup-rate') ?? 0.1),
    sources: (get('sources') ?? 'stripe,github,slack').split(',').map((s) => s.trim()),
    rps: Number(get('rps') ?? 25),
    stream: has('stream'),
    api: get('api') ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
  };
}

const PAYLOADS: Record<string, () => { type: string; data: Record<string, unknown> }> = {
  stripe: () => {
    const types = ['payment_intent.succeeded', 'charge.refunded', 'invoice.paid'];
    return {
      type: pick(types),
      data: { amount: 500 + Math.floor(Math.random() * 50_000), currency: 'usd' },
    };
  },
  github: () => {
    const types = ['push', 'pull_request.opened', 'issues.closed'];
    return { type: pick(types), data: { ref: 'refs/heads/main', repo: 'conduit' } };
  },
  slack: () => {
    const types = ['message.channels', 'app_mention', 'reaction_added'];
    return { type: pick(types), data: { channel: 'C123', user: 'U456' } };
  },
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

function secretFor(source: string): string {
  const secret = process.env[`WEBHOOK_SECRET_${source.toUpperCase()}`];
  if (!secret) {
    throw new Error(
      `Missing WEBHOOK_SECRET_${source.toUpperCase()} in env — the API would reject "${source}" (or set WEBHOOK_VERIFY=false).`,
    );
  }
  return secret;
}

interface Sent {
  source: string;
  body: string;
}

function buildBody(source: string): Sent {
  const shape = (PAYLOADS[source] ?? PAYLOADS.stripe)!();
  const payload = {
    idempotencyKey: `${source}_${randomUUID()}`,
    source,
    type: shape.type,
    ...shape.data,
  };
  return { source, body: JSON.stringify(payload) };
}

async function fire(
  api: string,
  s: Sent,
): Promise<{ ok: boolean; status: number; duplicate?: boolean }> {
  const signature = signPayload(secretFor(s.source), s.body);
  const url = `${api}${API_ROUTES.webhooks.ingest(s.source)}`;

  // Retry on 429 (rate limit) so counts stay exact — the retry re-sends the same body/key.
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [SIGNATURE_HEADER]: signature },
      body: s.body,
    });
    if (res.status === 429 && attempt < 50) {
      await sleep(250 * (attempt + 1));
      continue;
    }
    if (!res.ok) return { ok: false, status: res.status };
    const json = (await res.json()) as { duplicate: boolean };
    return { ok: true, status: res.status, duplicate: json.duplicate };
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const gapMs = args.rps > 0 ? 1000 / args.rps : 0;
  const pool: Sent[] = [];

  let uniquesSent = 0;
  let dupesSent = 0;
  let srvFalse = 0;
  let srvTrue = 0;
  let failures = 0;

  // eslint-disable-next-line no-console
  console.log(
    `→ firing ${args.stream ? '(stream)' : args.count} webhooks at ${args.api} ` +
      `[sources=${args.sources.join(',')} dup-rate=${args.dupRate} rps=${args.rps}]`,
  );

  let i = 0;
  while (args.stream || i < args.count) {
    const reuse = pool.length > 0 && Math.random() < args.dupRate;
    const s = reuse ? pick(pool) : buildBody(pick(args.sources));
    if (reuse) dupesSent++;
    else uniquesSent++;

    const res = await fire(args.api, s);
    if (!res.ok) failures++;
    else if (res.duplicate) srvTrue++;
    else {
      srvFalse++;
      if (!reuse) pool.push(s); // only unique, successfully-stored bodies are reusable
    }

    i++;
    if (args.stream && i % 25 === 0) {
      // eslint-disable-next-line no-console
      console.log(`  sent=${i} unique=${uniquesSent} dupes=${dupesSent} failures=${failures}`);
    }
    if (gapMs) await sleep(gapMs);
  }

  // eslint-disable-next-line no-console
  console.log(
    `\nDone. sent=${i} uniquesSent=${uniquesSent} dupesSent=${dupesSent} ` +
      `serverStoredNew=${srvFalse} serverDuplicates=${srvTrue} failures=${failures}`,
  );

  const pass = failures === 0 && srvFalse === uniquesSent && srvTrue === dupesSent;
  // eslint-disable-next-line no-console
  console.log(
    pass
      ? '✓ PASS — server stored exactly the unique count; every duplicate returned the original.'
      : '✗ FAIL — idempotency invariant did not hold (see counts above).',
  );
  if (!pass) process.exitCode = 1;
}

main().catch((e: unknown) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exitCode = 1;
});
