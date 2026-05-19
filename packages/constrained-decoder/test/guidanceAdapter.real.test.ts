import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildRouteGrammar, generateConstrainedRoute, serializeRouteGrammar } from '../src/llguidanceAdapter.js';

describe('guidance-ts constrained routing adapter', () => {
  it('builds deterministic serialized route grammars with guidance-ts', () => {
    const grammar = buildRouteGrammar([
      { schema: 'tool.v1.aaa', confidence: 0.95, reason: 'tool_match' },
      { schema: 'tool.v2.bbb', confidence: 1, reason: 'input_match' }
    ]);

    expect(serializeRouteGrammar(grammar)).toEqual(serializeRouteGrammar(grammar));
    expect(JSON.stringify(serializeRouteGrammar(grammar))).toContain('tool.v1.aaa');
  });

  it('does not import transformers-llguidance or fake missing server success', async () => {
    const source = await readFile(path.resolve(import.meta.dirname, '../src/llguidanceAdapter.ts'), 'utf8');

    expect(source).toContain('guidance-ts');
    expect(source).not.toContain('transformers-llguidance');
    await expect(generateConstrainedRoute({ grammar: buildRouteGrammar([]), prompt: 'route', sessionConfig: undefined })).resolves.toMatchObject({
      available: false,
      route: undefined
    });
  });
});
