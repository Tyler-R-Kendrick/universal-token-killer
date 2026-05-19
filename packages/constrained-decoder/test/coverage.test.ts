import { describe, expect, it, vi } from 'vitest';
import { validateAndRetry, validateWithLlguidance } from '../src/index.js';

describe('llguidance fallback coverage', () => {
  it('uses llguidance results when the module is available', async () => {
    vi.doMock('llguidance.ts', () => ({ validate: async () => ({ valid: false, errors: [1, 'bad'] }) }));
    await expect(validateWithLlguidance('start: "a"', 'a')).resolves.toEqual({ valid: false, errors: ['1', 'bad'] });
    vi.doUnmock('llguidance.ts');
  });

  it('reports missing llguidance validation results', async () => {
    vi.doMock('llguidance.ts', () => ({ validate: async () => undefined }));
    await expect(validateWithLlguidance('start: "a"', 'a')).resolves.toEqual({ valid: false, errors: ['llguidance.ts returned no result'] });
    vi.doUnmock('llguidance.ts');
  });

  it('normalizes missing llguidance error arrays', async () => {
    vi.doMock('llguidance.ts', () => ({ validate: async () => ({ valid: true, errors: 'ignored' }) }));
    await expect(validateWithLlguidance('start: "a"', 'a')).resolves.toEqual({ valid: true, errors: [] });
    vi.doUnmock('llguidance.ts');
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
