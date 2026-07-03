/**
 * Deterministic reference cost/latency model.
 *
 * MODELED, NOT MEASURED. Cost and latency are derived from token counts via the
 * constants below so committed numbers are reproducible offline. Swap this for a
 * real target — an object implementing {@link CostModel} that reports measured
 * prices/latencies from a live endpoint — through the harness `costModel` option.
 * Token counts and quality/fact-retention are real either way.
 */
export type CostModel = {
  id: string;
  /** USD per input (prompt) token. */
  priceInPerToken: number;
  /** USD per output (completion) token. */
  priceOutPerToken: number;
  /** USD per tool call (e.g. a recovery round-trip). */
  toolCallCostUsd: number;
  /** ms per input token (prefill). */
  prefillMsPerToken: number;
  /** ms per output token (decode). */
  decodeMsPerToken: number;
  /** ms per raw token a compaction technique must process. */
  compressMsPerToken: number;
  /** ms per tool round-trip. */
  toolCallMs: number;
  /** Fixed per-request model overhead (ms). */
  baseModelMs: number;
};

/** Prices ≈ a mid-tier hosted model; latencies ≈ typical prefill/decode + a tool round-trip. */
export const REFERENCE_MODEL: CostModel = {
  id: 'reference-model',
  priceInPerToken: 3e-6, // $3 / 1M input tokens
  priceOutPerToken: 15e-6, // $15 / 1M output tokens
  toolCallCostUsd: 2e-4, // $0.0002 / tool call
  prefillMsPerToken: 0.05,
  decodeMsPerToken: 8,
  compressMsPerToken: 0.02,
  toolCallMs: 700,
  baseModelMs: 120
};
