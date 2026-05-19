import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@utk/core': path.resolve(import.meta.dirname, 'packages/core/src/index.ts')
    }
  },
  test: {
    include: ['packages/**/*.test.ts', 'scripts/**/*.test.ts', 'test/**/*.test.ts', 'evals/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      all: true,
      include: ['packages/*/src/**/*.ts', 'packages/evals/assertions/**/*.ts', 'scripts/**/*.ts'],
      exclude: [
        '**/dist/**',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/node_modules/**',
        'packages/*/src/index.ts'
      ],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100
      }
    }
  }
});
