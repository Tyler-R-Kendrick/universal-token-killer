import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@utk/core': path.resolve(import.meta.dirname, 'packages/core/src/index.ts'),
      '@utk/foundation': path.resolve(import.meta.dirname, 'packages/foundation/src/index.ts'),
      '@utk/config': path.resolve(import.meta.dirname, 'packages/config/src/index.ts'),
      '@utk/tracing': path.resolve(import.meta.dirname, 'packages/tracing/src/index.ts'),
      '@utk/constrained-decoder': path.resolve(import.meta.dirname, 'packages/constrained-decoder/src/index.ts'),
      '@utk/code-graph': path.resolve(import.meta.dirname, 'packages/code-graph/src/index.ts'),
      '@utk/emission': path.resolve(import.meta.dirname, 'packages/emission/src/index.ts'),
      '@utk/lang-typescript': path.resolve(import.meta.dirname, 'packages/plugins/languages/typescript/src/index.ts')
    }
  },
  test: {
    testTimeout: 15000,
    include: ['packages/**/*.test.ts', 'scripts/**/*.test.ts', 'test/**/*.test.ts', 'evals/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      all: true,
      include: [
        'packages/*/src/**/*.ts',
        'packages/plugins/languages/*/src/**/*.ts',
        'packages/evals/assertions/**/*.ts',
        'scripts/**/*.ts'
      ],
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
