import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@utk/core': path.resolve(import.meta.dirname, '../core/src/index.ts')
    }
  },
  test: {
    include: ['**/*.test.ts']
  }
});
