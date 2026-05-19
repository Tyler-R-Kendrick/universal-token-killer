import { describe, expect, it } from 'vitest';
import { validateAndRetry, validateWithLlguidance } from '../src/index.js';

describe('llguidance adapter', () => {
  it('uses the declared llguidance package with fallback validation', async () => {
    const result = await validateWithLlguidance('start: "a"', 'a');
    expect(result.valid).toBe(true);
  });

  it('retries validation with fallback', async () => {
    let count = 0;
    const result = await validateAndRetry('start: "a"', async () => {
      count += 1;
      return count === 1 ? '' : 'a';
    });
    expect(result.valid).toBe(true);
  });
});
