import { defineAssertion } from '@agentv/sdk';

/**
 * Fact retention over the arm's RECOVERABLE surface.
 *
 * The target's output is an ArmSurfaceReport JSON (packages/evals/agentv/armCli.ts):
 * `{ arm, visible, recoverable, ... }`. Required facts come from the test's
 * `metadata.required_facts` (verbatim substrings of the raw tool output).
 *
 * HONESTY NOTE: an arm that persists the raw payload (the `utk` arm does)
 * retains 100% by construction — the report's `details.by_construction` flag
 * marks that so downstream readers do not mistake it for a measured result.
 */
export default defineAssertion(({ output, metadata }) => {
  const report = parseReport(output);
  if (!report) {
    return { pass: false, score: 0, assertions: [{ text: 'Target output is not an ArmSurfaceReport JSON', passed: false }] };
  }
  const requiredFacts = asStringArray((metadata as Record<string, unknown> | undefined)?.required_facts);
  if (requiredFacts.length === 0) {
    return { pass: true, assertions: [{ text: 'No required facts declared for this case', passed: true }] };
  }
  const retained = requiredFacts.filter((fact) => report.recoverable.includes(fact));
  const score = retained.length / requiredFacts.length;
  return {
    score,
    pass: score === 1,
    assertions: requiredFacts.map((fact) => ({
      text: `Recoverable surface retains: ${truncate(fact)}`,
      passed: report.recoverable.includes(fact)
    })),
    details: {
      retained: retained.length,
      required: requiredFacts.length,
      by_construction: report.arm === 'utk' || report.arm === 'baseline'
    }
  };
});

type ArmSurfaceReport = { arm: string; visible: string; recoverable: string };

function parseReport(output: string | null): ArmSurfaceReport | null {
  if (!output) return null;
  try {
    const parsed = JSON.parse(output) as ArmSurfaceReport;
    return typeof parsed.visible === 'string' && typeof parsed.recoverable === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function truncate(text: string): string {
  return text.length > 60 ? `${text.slice(0, 57)}...` : text;
}
