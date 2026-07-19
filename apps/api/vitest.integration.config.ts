import { defineConfig } from 'vitest/config';

/**
 * Integration tests hit a real Postgres (DATABASE_URL). Run via `pnpm test:int`, which
 * loads the monorepo-root .env through dotenv-cli. Files run serially so they don't
 * interfere on shared tables.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.int.spec.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
