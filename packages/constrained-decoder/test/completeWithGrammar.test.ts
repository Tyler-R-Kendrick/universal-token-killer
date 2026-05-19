import { describe, expect, it } from 'vitest';
import { completeWithGrammar, type CompleteWithGrammarRuntime } from '../src/completeWithGrammar.js';

function fakeRuntime(capture: string | undefined): CompleteWithGrammarRuntime {
  const grammarNode = { serialize: () => ({}) };
  return {
    Session: class {
      constructor(public url: string) {}
    } as unknown as CompleteWithGrammarRuntime['Session'],
    Generation: class {
      constructor(public session: unknown, public prompt: string, public grammar: unknown) {}
      async start() {}
      getCapture(_name: string) {
        return capture;
      }
    } as unknown as CompleteWithGrammarRuntime['Generation'],
    str: () => ({ join: () => grammarNode }),
    buildGrammar: () => grammarNode
  };
}

describe('completeWithGrammar', () => {
  it('reports unavailability when no session config is provided', async () => {
    const result = await completeWithGrammar({
      prompt: 'p',
      lark: 'start: x',
      slotName: 'slot'
    });
    expect(result.available).toBe(false);
    expect(result.errors[0]).toContain('not configured');
  });

  it('returns the captured completion when guidance succeeds', async () => {
    const result = await completeWithGrammar({
      prompt: 'p',
      lark: 'start: x',
      slotName: 'slot',
      sessionConfig: { url: 'http://example' },
      runtime: fakeRuntime('main')
    });
    expect(result.available).toBe(true);
    expect(result.completion).toBe('main');
  });

  it('reports a capture miss when guidance does not produce a value', async () => {
    const result = await completeWithGrammar({
      prompt: 'p',
      lark: 'start: x',
      slotName: 'slot',
      sessionConfig: { url: 'http://example' },
      runtime: fakeRuntime(undefined)
    });
    expect(result.available).toBe(true);
    expect(result.completion).toBeUndefined();
    expect(result.errors[0]).toContain('did not capture');
  });
});
