import { describe, expect, it } from 'vitest';
import { encode } from '@toon-format/toon';
import { assertAllowedRuleKindsOnly, assertNoForbiddenSpecialCaseStrings, assertRouteGrammarMatch } from '../assertions/artifacts.js';
import { assertCompactResponse, assertMaxOutputTokens, assertMaxPromptTokens } from '../assertions/tokenBudgets.js';
import { assertNoRawLeakage } from '../assertions/safety.assertions.js';

function routeToToon(schema: string, confidence: number, reason: string): string {
  return encode({ route: { schema, confidence, reason } });
}

describe('AgentV assertion helpers', () => {
  it('enforces token budgets and compact response limits', () => {
    expect(assertMaxPromptTokens('a'.repeat(2800))).toBe(true);
    expect(assertMaxOutputTokens(routeToToon('x', 1, 'shape_match'))).toBe(true);
    expect(assertCompactResponse('x'.repeat(400))).toBe(true);
  });

  it('enforces safety and artifact constraints', () => {
    expect(assertNoRawLeakage('compact reference only')).toBe(true);
    expect(assertNoRawLeakage('Tool result stored at: .utk/tools/t/observations/r/output.raw.json')).toBe(true);
    expect(assertNoRawLeakage('Tool result stored at: .utk/tools/t/observations/r/output.raw.json\nSchema: tool.v1.abc\nRoute confidence: 0.95\nFull payload was written to disk and omitted from chat context.')).toBe(true);
    expect(assertNoRawLeakage('Tool result stored at: .utk/tools/t/observations/r/output.raw.json\nSchema: tool.v1.abc\nSerializer: toon\nCompact artifact: .utk/tools/t/observations/r/output.compact.toon\nRoute confidence: 0.95\nFull payload was written to disk and omitted from chat context.')).toBe(true);
    expect(assertNoRawLeakage('Tool result stored at: .utk/tools/t/observations/r/output.raw.json leaked')).toBe(false);
    expect(assertAllowedRuleKindsOnly([{ kind: 'required-field' }, { kind: 'opaque' }])).toBe(true);
    expect(assertRouteGrammarMatch(routeToToon('tool.v1.abc', 1, 'shape_match'))).toBe(true);
    expect(assertRouteGrammarMatch('route:\n  [')).toBe(false);
    expect(assertNoForbiddenSpecialCaseStrings('generic structural rules only')).toBe(true);
  });
});
