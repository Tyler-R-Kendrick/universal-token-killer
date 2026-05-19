import { describe, expect, it } from 'vitest';
import { assertAllowedRuleKindsOnly, assertNoForbiddenSpecialCaseStrings, assertRouteGrammarMatch } from '../assertions/artifacts.js';
import { assertCompactResponse, assertMaxOutputTokens, assertMaxPromptTokens, estimateTokens } from '../assertions/tokenBudgets.js';
import { assertNoRawLeakage } from '../assertions/safety.assertions.js';
import { RTK_PARITY_EVALS } from './rtk-parity.eval.js';
import { UTK_SAFETY_EVALS } from './utk-safety.eval.js';

describe('eval assertion negative coverage', () => {
  it('covers failing assertion branches and eval list', () => {
    expect(assertAllowedRuleKindsOnly([{ kind: 'custom' }])).toBe(false);
    expect(assertNoForbiddenSpecialCaseStrings('docker command-specific optimization')).toBe(false);
    expect(assertRouteGrammarMatch('not-a-route')).toBe(false);
    expect(assertCompactResponse('x'.repeat(401))).toBe(false);
    expect(assertMaxPromptTokens('x'.repeat(2801))).toBe(false);
    expect(assertMaxOutputTokens('x'.repeat(129))).toBe(false);
    expect(assertNoRawLeakage('output.raw.json')).toBe(false);
    expect(estimateTokens('abcde')).toBe(2);
    expect(UTK_SAFETY_EVALS).toContain('zero-raw-payload-leakage');
    expect(RTK_PARITY_EVALS).toContain('shell-git-diff');
    expect(RTK_PARITY_EVALS).toContain('arbitrary-structured-tool-output');
  });
});
