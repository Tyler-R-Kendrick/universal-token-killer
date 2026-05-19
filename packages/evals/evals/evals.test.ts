import { describe, expect, it } from 'vitest';
import { assertAllowedRuleKindsOnly, assertNoForbiddenSpecialCaseStrings, assertRouteGrammarMatch } from '../assertions/artifacts.js';
import { assertCompactResponse, assertMaxOutputTokens, assertMaxPromptTokens } from '../assertions/tokenBudgets.js';
import { assertNoRawLeakage } from '../assertions/safety.assertions.js';

describe('AgentV assertion helpers', () => {
  it('enforces token budgets and compact response limits', () => {
    expect(assertMaxPromptTokens('a'.repeat(2800))).toBe(true);
    expect(assertMaxOutputTokens('route{schema:"x",confidence:1,reason:shape_match}')).toBe(true);
    expect(assertCompactResponse('x'.repeat(400))).toBe(true);
  });

  it('enforces safety and artifact constraints', () => {
    expect(assertNoRawLeakage('Tool result stored at: .utk/tools/t/observations/r/output.raw.json')).toBe(true);
    expect(assertAllowedRuleKindsOnly([{ kind: 'required-field' }, { kind: 'opaque' }])).toBe(true);
    expect(assertRouteGrammarMatch('route{schema:"tool.v1.abc",confidence:1,reason:shape_match}')).toBe(true);
    expect(assertNoForbiddenSpecialCaseStrings('generic structural rules only')).toBe(true);
  });
});
