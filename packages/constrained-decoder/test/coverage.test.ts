import { describe, expect, it } from 'vitest';
import { buildRouteGrammar, generateConstrainedRoute, serializeRouteGrammar, validateAndRetry, validateWithGuidance } from '../src/index.js';

describe('guidance-ts adapter coverage', () => {
  it('serializes deterministic route grammars for direct checks', () => {
    const grammar = buildRouteGrammar([{ schema: 'schema.a', confidence: 0.95, reason: 'tool_match' }]);
    expect(serializeRouteGrammar(grammar)).toEqual(serializeRouteGrammar(grammar));
  });

  it('rejects invalid candidates through explicit validators', async () => {
    await expect(validateWithGuidance('', () => ['empty candidate'])).resolves.toEqual({ valid: false, errors: ['empty candidate'] });
    await expect(validateWithGuidance('route', () => [])).resolves.toEqual({ valid: true, errors: [] });
  });

  it('returns retry failure after exhausting attempts', async () => {
    let attempts = 0;
    const result = await validateAndRetry(async () => {
      attempts += 1;
      return '';
    }, () => ['empty candidate'], 1);
    expect(attempts).toBe(2);
    expect(result).toEqual({ valid: false, errors: ['validation failed after retries'] });
  });

  it('does not fake constrained generation when no session is configured', async () => {
    await expect(generateConstrainedRoute({ grammar: buildRouteGrammar([]), prompt: 'route' })).resolves.toEqual({
      available: false,
      errors: ['guidance session is not configured'],
      route: undefined
    });
  });
});
