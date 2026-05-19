import { describe, expect, it } from 'vitest';
import { assertNoForbiddenSpecialCases, hasForbiddenSpecialCases } from './verify-no-special-cases.js';

describe('special-case verification helpers', () => {
  it('detects and rejects forbidden special cases', () => {
    expect(hasForbiddenSpecialCases('generic schema')).toBe(false);
    expect(hasForbiddenSpecialCases('hardcoded route')).toBe(true);
    expect(() => assertNoForbiddenSpecialCases('cli-specific optimization')).toThrow('Forbidden special-case optimization detected');
    expect(() => assertNoForbiddenSpecialCases('generic structural behavior')).not.toThrow();
  });
});
