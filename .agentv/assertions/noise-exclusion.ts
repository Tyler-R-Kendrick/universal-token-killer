import { defineAssertion } from '@agentv/sdk';

/**
 * Noise exclusion over the arm's VISIBLE surface: `metadata.irrelevant_facts`
 * should be dropped from what the model actually reads. Score is the excluded
 * ratio; the assertion passes at any score (it shapes the weighted mean rather
 * than gating — dropping noise is quality, not correctness).
 */
export default defineAssertion(({ output, metadata }) => {
  const report = parseReport(output);
  if (!report) {
    return { pass: false, score: 0, assertions: [{ text: 'Target output is not an ArmSurfaceReport JSON', passed: false }] };
  }
  const irrelevant = metaList(metadata, 'irrelevant_facts', 'irrelevantFacts');
  if (irrelevant.length === 0) {
    return { pass: true, assertions: [{ text: 'No irrelevant facts declared for this case', passed: true }] };
  }
  const excluded = irrelevant.filter((fact) => !report.visible.includes(fact));
  const score = excluded.length / irrelevant.length;
  return {
    score,
    pass: true,
    assertions: [{ text: `Visible surface drops ${excluded.length}/${irrelevant.length} noise facts`, passed: excluded.length === irrelevant.length }],
    details: { excluded: excluded.length, irrelevant: irrelevant.length }
  };
});

function parseReport(output: string | null): { visible: string } | null {
  if (!output) return null;
  try {
    const parsed = JSON.parse(output) as { visible?: unknown };
    return typeof parsed.visible === 'string' ? { visible: parsed.visible } : null;
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
