# Deploying Conduit to Render

One Blueprint brings up the whole stack: the API (which also runs the delivery worker,
outbox dispatcher and reconciler in-process), the dashboard, Postgres, and a Key Value
instance for BullMQ. Everything is on the free tier.

Read [Free-tier reality](#free-tier-reality) before you demo — the constraints are real and
they shape what you should show.

---

## 1 · Before you start

- The blueprint deploys from a **branch on GitHub**. Render reads `render.yaml` from the
  branch you point it at (`master` by default).
- Have these to hand — Render prompts for each on creation:
  | Prompt | What to enter |
  | --- | --- |
  | `RESEND_API_KEY` | A real `re_...` key sends actual email. Leave **blank** for SIMULATED mode — no mail is sent, but retry / DLQ / replay behave identically, which is enough for the demo. |
  | `EMAIL_FROM` | An address on a domain **verified with Resend**. Anything else is rejected at send time, not at boot. |
  | `WEBHOOK_SECRET_MONNIFY` | Your Monnify **client secret**. Ingest verifies SHA-512 over the raw body. |
  | `WEBHOOK_SECRET_STRIPE` / `_GITHUB` / `_SLACK` | Any non-empty string if you only intend to use the generator; it signs with whatever you set here. |

You do **not** supply `CONDUIT_API_KEY`. Render generates it on the API and copies it to the
dashboard, so the two always agree and the secret never passes through your clipboard.

## 2 · Create the Blueprint

1. Push the branch containing `render.yaml`.
2. Render Dashboard → **New** → **Blueprint**.
3. Select the repository and the branch.
4. Render parses `render.yaml` and lists four resources: `conduit-api-apiconf`,
   `conduit-dashboard-apiconf`, `conduit-cache`, `conduit-db`.
5. Fill in the prompted secrets from the table above.
6. **Apply**. First build takes roughly 5–10 minutes; both web services build the full
   workspace.

## 3 · Fix the URLs (do this once, right after the first deploy)

A free web service **cannot receive private-network traffic**, so the dashboard reaches the
API over its public URL — which means two values in `render.yaml` are hardcoded guesses:

```yaml
# conduit-api-apiconf
- key: WEB_ORIGIN
  value: https://conduit-dashboard-apiconf.onrender.com
# conduit-dashboard-apiconf
- key: CONDUIT_API_URL
  value: https://conduit-api-apiconf.onrender.com
```

Service names are near-globally-unique on `onrender.com`. If either name was taken, Render
appends a suffix and these URLs are wrong. Check each service's actual URL in the dashboard;
if they differ, edit `render.yaml`, push, and re-sync the blueprint.

**Symptom of getting this wrong:** the dashboard loads but every panel shows
`UPSTREAM_UNREACHABLE` (a 502 from the proxy).

## 4 · Verify

```bash
API=https://conduit-api-apiconf.onrender.com
WEB=https://conduit-dashboard-apiconf.onrender.com

# 1. API is alive (first call after idle takes ~1 min — this is the cold start)
curl -s $API/health

# 2. Dashboard is alive
curl -s $WEB/api/health

# 3. The API is actually protected. Expect 401.
curl -s -o /dev/null -w '%{http_code}\n' $API/stats

# 4. The dashboard's proxy can reach it. Expect 200 and a JSON stats body.
curl -s $WEB/api/conduit/stats
```

If 3 returns `200` instead of `401`, `CONDUIT_API_KEY` did not reach the API and **the
service is open to the internet** — fix before doing anything else.

Then open `$WEB` in a browser: it should land on the event stream.

## 5 · Put data through it

Nothing is seeded. Point the generator at the deployed API from your laptop — it signs each
webhook with the same secrets you entered in step 1:

```bash
# Real-shaped Monnify notifications, signed the way Monnify signs them (SHA-512),
# with 20% deliberate duplicates to demonstrate idempotency.
WEBHOOK_SECRET_MONNIFY='<the secret you entered>' \
  pnpm --filter @conduit/api webhooks:generate -- \
  --api https://conduit-api-apiconf.onrender.com --sources monnify --count 100 --dup-rate 0.2
```

It prints PASS/FAIL on the invariant: the server stored exactly the unique count, and every
duplicate returned the original event.

To exercise retry, the DLQ and replay, set `DELIVERY_FAIL_RATE` to e.g. `0.15` on the API
service (Environment → Add), let it redeploy, and generate again — some sends will retry
with visible backoff and some will dead-letter, ready to replay from `/dlq`.

## 6 · Point Monnify at it

In the Monnify dashboard (sandbox), set the webhook URL to:

```
https://conduit-api-apiconf.onrender.com/webhooks/monnify
```

`POST /webhooks/:source` is deliberately exempt from `CONDUIT_API_KEY` — Monnify cannot send
our key. It is authenticated by its own HMAC signature instead, which is a stronger
guarantee: it proves the payload is untampered, not merely that the caller knows a shared
secret.

> Cold starts matter here. If the service is spun down, Monnify's first notification may
> time out. Monnify retries, and ingest is idempotent, so this is recoverable — but warm the
> service first if you are demoing live.

---

## Free-tier reality

These are constraints of the tier, not bugs, and they are worth stating plainly rather than
discovering during a demo.

| | Consequence |
| --- | --- |
| **Web services spin down after 15 min idle** | The process is **stopped**, not throttled. The BullMQ worker consumes nothing and the reconciler's `setInterval` does not fire. Cold start is ~1 minute. **Hit `/health` a minute before demoing.** |
| **750 free instance-hours/month per workspace** | Two always-on free web services cannot both stay up for a whole month. Idle (spun-down) time doesn't count, so normal demo use is fine. |
| **Free Key Value has no persistence** | A restart drops queued and delayed jobs. Survivable by design: the delivery intent is committed to Postgres in the transactional outbox and the dispatcher re-enqueues from there. `maxmemoryPolicy` is set to `noeviction` because BullMQ requires its keys are never evicted. |
| **Free Postgres expires 30 days after creation** | Then a 14-day grace period before Render deletes it *and all data*. Diarise it. |
| **Free services can't receive private-network traffic** | Hence the hardcoded public URLs in step 3. API → Postgres and API → Key Value *do* use the private network, which is why every resource pins `region: oregon` — private networking only works within one region. |

### Making it production-shaped

In rough order of value:

1. **Move the worker to its own service** (`type: worker`, paid). Today the worker shares a
   process with the API, so it dies with the API's spin-down and competes with request
   handling. This is the single change that makes delivery reliable rather than
   demo-reliable.
2. **Paid Postgres** — for backups, connection pooling, and no 30-day cliff.
3. **A user session in front of the dashboard.** The proxy protects the *key*, not the
   *data*: anyone who can load the dashboard can use it.
4. **`preDeployCommand` for migrations** instead of running `migrate deploy` on every boot.
   Idempotent either way, but a pre-deploy hook fails the deploy rather than crash-looping
   the service.
