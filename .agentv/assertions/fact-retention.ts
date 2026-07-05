import { defineAssertion } from '@agentv/sdk';

/**
 * Fact retention over the arm's RECOVERABLE surface.
 *
 * The target's output is an ArmSurfaceReport JSON (packages/evals/agentv/armCli.ts):
 * `{ arm, visible, recoverable, ... }`. Required facts come from the test's
 * `metadata.required_facts` (verbatim substrings of the raw tool output).
 *
 * HONESTY NOTE: arms whose recoverable surface is the raw payload retain 100%
 * by construction — `utk` (persists raw off-context) and `baseline` (reads raw
 * verbatim) both are. The report's `details.by_construction` flag marks those
 * arms so downstream readers do not mistake the score for a measured result.
 */
export default defineAssertion(({ output, metadata }) => {
  const report = parseReport(output);
  if (!report) {
    return { pass: false, score: 0, assertions: [{ text: 'Target output is not an ArmSurfaceReport JSON', passed: false }] };
  }
  const requiredFacts = metaList(metadata, 'required_facts', 'requiredFacts');
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


/** SDK deep-converts stdin keys to camelCase, so user metadata arrives as
 * camelCase too; accept both forms to stay robust across SDK versions. */
function metaList(meta: unknown, snake: string, camel: string): string[] {
  const record = (meta ?? {}) as Record<string, unknown>;
  return asStringArray(record[camel] ?? record[snake]);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function truncate(text: string): string {
  return text.length > 60 ? `${text.slice(0, 57)}...` : text;
}
