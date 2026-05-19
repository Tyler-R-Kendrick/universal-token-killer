import { describe, expect, it } from 'vitest';
import { validateAndRetry, validateWithLlguidance } from '../src/index.js';

describe('llguidance fallback coverage', () => {
  it('uses declared llguidance dependency and fallback validation for direct checks', async () => {
    await expect(import('llguidance.ts')).resolves.toHaveProperty('GuidanceParser');
    await expect(validateWithLlguidance('start: "a"', 'a')).resolves.toEqual({ valid: true, errors: [] });
  });

  it('rejects empty grammar and empty candidates through fallback validation', async () => {
    await expect(validateWithLlguidance('', 'candidate')).resolves.toEqual({ valid: false, errors: ['empty grammar'] });
    await expect(validateWithLlguidance('start: "a"', '')).resolves.toEqual({ valid: false, errors: ['empty candidate'] });
  });

  it('returns retry failure after exhausting attempts', async () => {
    let attempts = 0;
    const result = await validateAndRetry('start: "a"', async () => {
      attempts += 1;
      return '';
    }, 1);
    expect(attempts).toBe(2);
    expect(result).toEqual({ valid: false, errors: ['validation failed after retries'] });
  });
});
