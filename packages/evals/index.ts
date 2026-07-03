// Comparison harness: benchmark data → 3 concurrent arms (baseline / competitor / utk) → graders.
export * from './data.js';
export * from './harness.js';
export * from './graders/index.js';
export * from './comparison/index.js';
export * from './report.js';

// agentevals.io evaluator protocol + baseline store (trace-based TDD substrate).
export * from './evaluators/index.js';
export * from './evaluators/loadUtkTrace.js';
export * from './baselines/baselineStore.js';

// LeanCTX Copilot benchmark fixtures (consumed by scripts/bench-leanctx-copilot.ts).
export { leanCtxCopilotFixtures, type LeanCtxCopilotFixture, type LeanCtxCopilotFixtureKind } from './fixtures/leanCtxCopilotFixtures.js';
