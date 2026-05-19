import { defineConfig } from 'vitest/config';

export default defineConfig({
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
        'packages/*/src/index.ts',
        'packages/vscode-extension/src/extension.ts',
        'packages/vscode-extension/src/extension/index.ts'
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
