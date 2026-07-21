/**
 * Liveness probe for the dashboard itself. Deliberately does NOT touch the API — a health
 * check that fails when its upstream is down turns one cold start into a restart loop.
 */
export function GET(): Response {
  return Response.json({ status: 'ok', uptime: process.uptime() });
}

export const dynamic = 'force-dynamic';
