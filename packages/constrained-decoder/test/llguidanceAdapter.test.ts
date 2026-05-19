import { describe, expect, it } from 'vitest';
import { buildRouteGrammar, generateConstrainedRoute, serializeRouteGrammar, validateAndRetry, validateWithGuidance } from '../src/index.js';

describe('llguidance adapter', () => {
  it('uses guidance-ts grammar serialization instead of fallback validation', () => {
    const grammar = buildRouteGrammar([{ schema: 'tool.v1.abc', confidence: 1, reason: 'input_match' }]);
    const serialized = serializeRouteGrammar(grammar);
    expect(JSON.stringify(serialized)).toContain('tool.v1.abc');
  });

  it('retries explicit validators without accepting fake success', async () => {
    let count = 0;
    const result = await validateAndRetry(async () => {
      count += 1;
      return count === 1 ? '' : 'a';
    }, (candidate) => validateWithGuidance(candidate, (value) => value === 'a' ? [] : ['candidate did not match grammar']));
    expect(result.valid).toBe(true);
  });

  it('reports unavailable constrained generation without a Guidance session', async () => {
    await expect(generateConstrainedRoute({ grammar: buildRouteGrammar([]), prompt: 'route' })).resolves.toMatchObject({ available: false });
  });

  it('reports incomplete Guidance captures and returns complete captured routes', async () => {
    const grammar = buildRouteGrammar([]);
    class FakeSession {
      constructor(readonly url: string) {}
    }
    class IncompleteGeneration {
      constructor(_session: unknown, _prompt: string, _grammar: unknown) {}
      async start(): Promise<void> {}
      getCapture(): string | undefined {
        return undefined;
      }
    }
    class CompleteGeneration {
      constructor(_session: unknown, _prompt: string, _grammar: unknown) {}
      async start(): Promise<void> {}
      getCapture(name: string): string | undefined {
        return { schema: 'tool.v1.abc', confidence: '0.95', reason: 'tool_match' }[name];
      }
    }
    const runtime = {
      Session: FakeSession,
      Generation: IncompleteGeneration,
      str: () => ({ join: () => grammar })
    };

    await expect(generateConstrainedRoute({ grammar, prompt: 'route', sessionConfig: { url: 'http://localhost' }, runtime })).resolves.toMatchObject({
      available: true,
      route: undefined
    });
    await expect(generateConstrainedRoute({
      grammar,
      prompt: 'route',
      sessionConfig: { url: 'http://localhost' },
      runtime: { ...runtime, Generation: CompleteGeneration }
    })).resolves.toMatchObject({
      available: true,
      route: { schema: 'tool.v1.abc', confidence: 0.95, reason: 'tool_match' }
    });
  });
});
