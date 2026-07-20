import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// Resolve the `@/` path alias (mirrors tsconfig) so unit tests can import
// modules the same way application code does.
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(process.cwd(), 'src'),
    },
  },
});
