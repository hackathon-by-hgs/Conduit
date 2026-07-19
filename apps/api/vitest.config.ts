import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Hermetic unit tests only — DB-backed integration tests live in test/*.int.spec.ts.
    include: ['src/**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/*.int.spec.ts'],
  },
});
