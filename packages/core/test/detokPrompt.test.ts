import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { compressPromptForLlm, loadUtkConfig } from '../src/index.js';

describe('detoks-prompt compression', () => {
  it('defaults prompt compression to default/LLMLingua2 in config', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-detoks-prompt-default-'));
    const config = await loadUtkConfig(root);

    expect(config.detok.prompt.model).toBe('default/LLMLingua2');
  });

  it('loads configured provider/model for prompt compression', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-detoks-prompt-config-'));
    await mkdir(path.join(root, '.utk'), { recursive: true });
    await writeFile(
      path.join(root, '.utk', 'config.toml'),
      [
        '[serialization]',
        'default = "toon"',
        '',
        '[detok.prompt]',
        'model = "Hugging-Face/Kompress-small"',
        'rate = 0.5',
        ''
      ].join('\n'),
      'utf8'
    );

    const config = await loadUtkConfig(root);

    expect(config.detok.prompt.model).toBe('Hugging-Face/Kompress-small');
    expect(config.detok.prompt.rate).toBe(0.5);
  });

  it('compresses only natural-language prompt spans and preserves code plus quotes', async () => {
    const previousFake = process.env.UTK_DETOK_FAKE;
    process.env.UTK_DETOK_FAKE = '1';
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-detoks-prompt-safe-'));
    try {
      const prompt = [
        'Please explain this implementation in detail and remove unnecessary filler around it.',
        '',
        '```ts',
        'const value = "keep exact code string";',
        'console.log(value);',
        '```',
        '',
        '> Quoted region must remain exactly as written.',
        '',
        'Do not change "literal quoted requirement" while reducing surrounding explanation.'
      ].join('\n');

      const result = await compressPromptForLlm(prompt, {
        workspaceRoot: root,
        rate: 0.5
      });

      expect(result.model).toBe('default/LLMLingua2');
      expect(result.compressedPrompt).toContain('```ts\nconst value = "keep exact code string";\nconsole.log(value);\n```');
      expect(result.compressedPrompt).toContain('> Quoted region must remain exactly as written.');
      expect(result.compressedPrompt).toContain('"literal quoted requirement"');
      expect(result.compressedPrompt).not.toContain('unnecessary filler around it');
      expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'fenced-code')).toBe(true);
      expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'blockquote')).toBe(true);
      expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'quoted-string')).toBe(true);
    } finally {
      if (previousFake === undefined) {
        delete process.env.UTK_DETOK_FAKE;
      } else {
        process.env.UTK_DETOK_FAKE = previousFake;
      }
    }
  });
});
