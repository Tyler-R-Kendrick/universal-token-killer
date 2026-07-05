import { defineAssertion } from '@agentv/sdk';

/**
 * Honest token accounting for one arm surface:
 *
 *   charged = visible_tokens + recovery_tokens   (recovery is never free)
 *   score   = clamp(1 - charged / raw_tokens, 0, 1)
 *
 * `pass` only asserts non-inflation (charged <= raw) — a 0%-reduction baseline
 * legitimately passes with score 0. All numbers are ceil(len/4) estimates of
 * real surfaces; no LLM is involved (see docs/features/evals/benchmark-integrity.md).
 */
export default defineAssertion(({ output }) => {
  const report = parseReport(output);
  if (!report) {
    return { pass: false, score: 0, assertions: [{ text: 'Target output is not an ArmSurfaceReport JSON', passed: false }] };
  }
  const charged = report.visible_tokens + report.recovery_tokens;
  const reduction = report.raw_tokens > 0 ? 1 - charged / report.raw_tokens : 0;
  const nonInflating = charged <= report.raw_tokens;
  return {
    pass: nonInflating,
    score: Math.max(0, Math.min(1, reduction)),
    assertions: [
      { text: `Charged tokens (visible ${report.visible_tokens} + recovery ${report.recovery_tokens}) do not exceed raw ${report.raw_tokens}`, passed: nonInflating }
    ],
    details: {
      visible_tokens: report.visible_tokens,
      recovery_tokens: report.recovery_tokens,
      raw_tokens: report.raw_tokens,
      reduction: Math.round(reduction * 1000) / 1000
    }
  };
});

type Report = { visible_tokens: number; recovery_tokens: number; raw_tokens: number };

function parseReport(output: string | null): Report | null {
  if (!output) return null;
  try {
    const parsed = JSON.parse(output) as Partial<Report>;
    if (typeof parsed.visible_tokens === 'number' && typeof parsed.recovery_tokens === 'number' && typeof parsed.raw_tokens === 'number') {
      return parsed as Report;
    }
    return null;
  } catch {
    return null;
  }
}
