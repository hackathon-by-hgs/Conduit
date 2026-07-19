import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

/**
 * Local dev: hydrate process.env from the monorepo-root .env (and an app-local .env if
 * present) before Nest boots — so dynamically-read secrets like WEBHOOK_SECRET_<SOURCE>
 * are available. `override` defaults to false, so real platform env vars (e.g. on Render)
 * always win and the missing files are simply no-ops there.
 */
loadEnv({ path: resolve(process.cwd(), '../../.env') });
loadEnv();
