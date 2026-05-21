import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { compressPromptForLlm, loadUtkConfig } from '../src/index.js';

async function withFakePromptCompression(
  tempPrefix: string,
  prompt: string,
  assertions: (result: Awaited<ReturnType<typeof compressPromptForLlm>>) => void
): Promise<void> {
  const previousFake = process.env.UTK_DETOK_FAKE;
  process.env.UTK_DETOK_FAKE = '1';
  const root = await mkdtemp(path.join(os.tmpdir(), tempPrefix));
  try {
    const result = await compressPromptForLlm(prompt, {
      workspaceRoot: root,
      rate: 0.25
    });

    assertions(result);
  } finally {
    if (previousFake === undefined) {
      delete process.env.UTK_DETOK_FAKE;
    } else {
      process.env.UTK_DETOK_FAKE = previousFake;
    }
  }
}

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

  it('preserves markdown links, reference links, urls, file paths, and issue refs while compressing prose', async () => {
    const previousFake = process.env.UTK_DETOK_FAKE;
    process.env.UTK_DETOK_FAKE = '1';
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-detoks-prompt-link-path-safe-'));
    try {
      const prompt = [
        'Please carefully reduce this verbose task description while keeping every reference target unchanged.',
        '',
        'Read [detoks prompt docs](skills/detoks/references/detoks-prompt.md) before editing.',
        'Compare [package boundary][pkg-boundary] and https://docs.github.com/en/copilot/reference/custom-agents-configuration.',
        'Open C:\\src\\utk\\skills\\detoks\\SKILL.md and packages/core/src/detok/prompt.ts.',
        'Keep issue #123, PR gh-456, and @octocat/repo references intact.',
        '',
        '[pkg-boundary]: packages/core/test/packageBoundary.test.ts'
      ].join('\n');

      const result = await compressPromptForLlm(prompt, {
        workspaceRoot: root,
        rate: 0.33
      });

      expect(result.compressedPrompt).toContain('[detoks prompt docs](skills/detoks/references/detoks-prompt.md)');
      expect(result.compressedPrompt).toContain('[package boundary][pkg-boundary]');
      expect(result.compressedPrompt).toContain('https://docs.github.com/en/copilot/reference/custom-agents-configuration');
      expect(result.compressedPrompt).toContain('C:\\src\\utk\\skills\\detoks\\SKILL.md');
      expect(result.compressedPrompt).toContain('packages/core/src/detok/prompt.ts');
      expect(result.compressedPrompt).toContain('#123');
      expect(result.compressedPrompt).toContain('gh-456');
      expect(result.compressedPrompt).toContain('@octocat/repo');
      expect(result.compressedPrompt).toContain('[pkg-boundary]: packages/core/test/packageBoundary.test.ts');
      expect(result.compressedPrompt).not.toContain('keeping every reference target unchanged');
      expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'markdown-link')).toBe(true);
      expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'reference-link')).toBe(true);
      expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'url')).toBe(true);
      expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'filepath')).toBe(true);
      expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'reference')).toBe(true);
    } finally {
      if (previousFake === undefined) {
        delete process.env.UTK_DETOK_FAKE;
      } else {
        process.env.UTK_DETOK_FAKE = previousFake;
      }
    }
  });

  it('preserves tool, command, API, and schema identifiers around punctuation', async () => {
    const previousFake = process.env.UTK_DETOK_FAKE;
    process.env.UTK_DETOK_FAKE = '1';
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-detoks-prompt-identifier-safe-'));
    try {
      const prompt = [
        'Reduce this detailed explanation aggressively while keeping operational identifiers unchanged.',
        'Run node packages/cli/dist/utk.js detoks-prompt --file .\\prompt.md before calling detok.detoks-prompt.',
        'Preserve compressPromptForLlm(), loadUtkConfig, DetokResult, JSON_SCHEMA, and $.tools[0].id exactly.'
      ].join('\n');

      const result = await compressPromptForLlm(prompt, {
        workspaceRoot: root,
        rate: 0.25
      });

      expect(result.compressedPrompt).toContain('node packages/cli/dist/utk.js detoks-prompt --file .\\prompt.md');
      expect(result.compressedPrompt).toContain('detok.detoks-prompt');
      expect(result.compressedPrompt).toContain('compressPromptForLlm()');
      expect(result.compressedPrompt).toContain('loadUtkConfig');
      expect(result.compressedPrompt).toContain('DetokResult');
      expect(result.compressedPrompt).toContain('JSON_SCHEMA');
      expect(result.compressedPrompt).toContain('$.tools[0].id');
      expect(result.compressedPrompt).not.toContain('operational identifiers unchanged');
      expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'command')).toBe(true);
      expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'api-name')).toBe(true);
      expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'schema-reference')).toBe(true);
    } finally {
      if (previousFake === undefined) {
        delete process.env.UTK_DETOK_FAKE;
      } else {
        process.env.UTK_DETOK_FAKE = previousFake;
      }
    }
  });

  it('preserves frontmatter, footnotes, autolinks, and markdown links with parentheses', async () => {
    const previousFake = process.env.UTK_DETOK_FAKE;
    process.env.UTK_DETOK_FAKE = '1';
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-detoks-prompt-markdown-edge-safe-'));
    try {
      const prompt = [
        'Trim this long custom-agent guidance while preserving exact markdown control surfaces.',
        '---',
        'name: detoks-ghcp-subagent',
        'description: Clean GitHub Copilot custom agents without changing handoff metadata.',
        'tools: ["agent", "read_file"]',
        '---',
        '',
        'Keep the footnote marker [^handoff-note] and the image ![flow diagram](assets/flow(v2).png).',
        'Retain autolinks <https://example.com/docs/path?q=a&b=c> and <security@example.com>.',
        '',
        '[^handoff-note]: This footnote text stays exact for citation recovery.'
      ].join('\n');

      const result = await compressPromptForLlm(prompt, {
        workspaceRoot: root,
        rate: 0.25
      });

      expect(result.compressedPrompt).toContain('---\nname: detoks-ghcp-subagent');
      expect(result.compressedPrompt).toContain('description: Clean GitHub Copilot custom agents without changing handoff metadata.');
      expect(result.compressedPrompt).toContain('tools: ["agent", "read_file"]\n---');
      expect(result.compressedPrompt).toContain('[^handoff-note]');
      expect(result.compressedPrompt).toContain('![flow diagram](assets/flow(v2).png)');
      expect(result.compressedPrompt).toContain('<https://example.com/docs/path?q=a&b=c>');
      expect(result.compressedPrompt).toContain('<security@example.com>');
      expect(result.compressedPrompt).toContain('[^handoff-note]: This footnote text stays exact for citation recovery.');
      expect(result.compressedPrompt).not.toContain('preserving exact markdown control surfaces');
      expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'frontmatter')).toBe(true);
      expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'markdown-link')).toBe(true);
      expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'reference')).toBe(true);
      expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'url')).toBe(true);
    } finally {
      if (previousFake === undefined) {
        delete process.env.UTK_DETOK_FAKE;
      } else {
        process.env.UTK_DETOK_FAKE = previousFake;
      }
    }
  });

  it('preserves file paths with spaces and commands with quoted arguments', async () => {
    const previousFake = process.env.UTK_DETOK_FAKE;
    process.env.UTK_DETOK_FAKE = '1';
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-detoks-prompt-command-path-edge-safe-'));
    try {
      const prompt = [
        'Shorten this explanation but keep all operational strings byte-for-byte for copy paste.',
        'Open C:\\Program Files\\Git\\bin\\git.exe and docs/My Report.md before editing.',
        'Run npx vitest run "packages/core/test/detokPrompt.test.ts" --reporter=verbose.',
        'Then run pwsh -File ".\\scripts\\Verify Detoks.ps1" -LiteralPath "C:\\src\\utk\\My Prompt.md".'
      ].join('\n');

      const result = await compressPromptForLlm(prompt, {
        workspaceRoot: root,
        rate: 0.25
      });

      expect(result.compressedPrompt).toContain('C:\\Program Files\\Git\\bin\\git.exe');
      expect(result.compressedPrompt).toContain('docs/My Report.md');
      expect(result.compressedPrompt).toContain('npx vitest run "packages/core/test/detokPrompt.test.ts" --reporter=verbose');
      expect(result.compressedPrompt).toContain('pwsh -File ".\\scripts\\Verify Detoks.ps1" -LiteralPath "C:\\src\\utk\\My Prompt.md"');
      expect(result.compressedPrompt).not.toContain('byte-for-byte for copy paste');
      expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'filepath')).toBe(true);
      expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'command')).toBe(true);
    } finally {
      if (previousFake === undefined) {
        delete process.env.UTK_DETOK_FAKE;
      } else {
        process.env.UTK_DETOK_FAKE = previousFake;
      }
    }
  });

  it('preserves markdown tables, html, and template placeholders', async () => {
    const previousFake = process.env.UTK_DETOK_FAKE;
    process.env.UTK_DETOK_FAKE = '1';
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-detoks-prompt-structured-markdown-safe-'));
    try {
      const prompt = [
        'Compress this lengthy explanation while retaining structured markdown and template syntax exactly.',
        '',
        '| Field | Required | Notes |',
        '| --- | ---: | --- |',
        '| `tools` | yes | Keep `${{ github.sha }}` and `{{ user.name }}`. |',
        '| `model` | no | Preserve `<% if (enabled) { %>` markers. |',
        '',
        '<!-- keep-detoks-boundary:abc123 -->',
        '<details><summary>Exact config</summary>Do not rewrite attributes.</details>'
      ].join('\n');

      const result = await compressPromptForLlm(prompt, {
        workspaceRoot: root,
        rate: 0.25
      });

      expect(result.compressedPrompt).toContain('| Field | Required | Notes |\n| --- | ---: | --- |');
      expect(result.compressedPrompt).toContain('| `tools` | yes | Keep `${{ github.sha }}` and `{{ user.name }}`. |');
      expect(result.compressedPrompt).toContain('| `model` | no | Preserve `<% if (enabled) { %>` markers. |');
      expect(result.compressedPrompt).toContain('<!-- keep-detoks-boundary:abc123 -->');
      expect(result.compressedPrompt).toContain('<details><summary>Exact config</summary>Do not rewrite attributes.</details>');
      expect(result.compressedPrompt).not.toContain('retaining structured markdown and template syntax exactly');
      expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'table')).toBe(true);
      expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'html')).toBe(true);
    } finally {
      if (previousFake === undefined) {
        delete process.env.UTK_DETOK_FAKE;
      } else {
        process.env.UTK_DETOK_FAKE = previousFake;
      }
    }
  });

  it('preserves env-prefixed commands, globs, packages, model ids, versions, and hashes', async () => {
    const previousFake = process.env.UTK_DETOK_FAKE;
    process.env.UTK_DETOK_FAKE = '1';
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-detoks-prompt-operational-id-safe-'));
    try {
      const prompt = [
        'Reduce this operational note but keep exact install and validation identifiers intact.',
        'Run NODE_OPTIONS=--max-old-space-size=8192 npm test -- --run "packages/**/test/*.test.ts" | tee ".\\logs\\test output.txt".',
        'Install @openai/agents@1.2.3-beta.4 and @modelcontextprotocol/server-filesystem.',
        'Route default/LLMLingua2, Hugging-Face/Kompress-small, and openai/gpt-4.1-mini without changing names.',
        'Keep sha 4b7838dcaa1e0563f632f2ec4a27c7c8c41e6552 and run id 019c6e27-e55b-73d1-87d8-4e01f1f75043.'
      ].join('\n');

      const result = await compressPromptForLlm(prompt, {
        workspaceRoot: root,
        rate: 0.25
      });

      expect(result.compressedPrompt).toContain('NODE_OPTIONS=--max-old-space-size=8192 npm test -- --run "packages/**/test/*.test.ts" | tee ".\\logs\\test output.txt"');
      expect(result.compressedPrompt).toContain('@openai/agents@1.2.3-beta.4');
      expect(result.compressedPrompt).toContain('@modelcontextprotocol/server-filesystem');
      expect(result.compressedPrompt).toContain('default/LLMLingua2');
      expect(result.compressedPrompt).toContain('Hugging-Face/Kompress-small');
      expect(result.compressedPrompt).toContain('openai/gpt-4.1-mini');
      expect(result.compressedPrompt).toContain('4b7838dcaa1e0563f632f2ec4a27c7c8c41e6552');
      expect(result.compressedPrompt).toContain('019c6e27-e55b-73d1-87d8-4e01f1f75043');
      expect(result.compressedPrompt).not.toContain('install and validation identifiers intact');
      expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'command')).toBe(true);
      expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'package-name')).toBe(true);
      expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'model-id')).toBe(true);
      expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'hash')).toBe(true);
    } finally {
      if (previousFake === undefined) {
        delete process.env.UTK_DETOK_FAKE;
      } else {
        process.env.UTK_DETOK_FAKE = previousFake;
      }
    }
  });

  it('preserves unified diffs and patch hunks', async () => {
    const previousFake = process.env.UTK_DETOK_FAKE;
    process.env.UTK_DETOK_FAKE = '1';
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-detoks-prompt-diff-safe-'));
    try {
      const prompt = [
        'Summarize this change request but never rewrite patch syntax.',
        'diff --git a/packages/core/src/detok/prompt.ts b/packages/core/src/detok/prompt.ts',
        'index 1234567..89abcde 100644',
        '--- a/packages/core/src/detok/prompt.ts',
        '+++ b/packages/core/src/detok/prompt.ts',
        '@@ -10,7 +10,8 @@ export function x() {',
        '-  return oldValue;',
        '+  return newValue;',
        ' }'
      ].join('\n');

      const result = await compressPromptForLlm(prompt, {
        workspaceRoot: root,
        rate: 0.25
      });

      expect(result.compressedPrompt).toContain('diff --git a/packages/core/src/detok/prompt.ts b/packages/core/src/detok/prompt.ts');
      expect(result.compressedPrompt).toContain('@@ -10,7 +10,8 @@ export function x() {');
      expect(result.compressedPrompt).toContain('-  return oldValue;\n+  return newValue;');
      expect(result.compressedPrompt).not.toContain('never rewrite patch syntax');
      expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'diff')).toBe(true);
    } finally {
      if (previousFake === undefined) {
        delete process.env.UTK_DETOK_FAKE;
      } else {
        process.env.UTK_DETOK_FAKE = previousFake;
      }
    }
  });

  it('preserves stack traces and diagnostic locations', async () => {
    const previousFake = process.env.UTK_DETOK_FAKE;
    process.env.UTK_DETOK_FAKE = '1';
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-detoks-prompt-stack-safe-'));
    try {
      const prompt = [
        'Reduce this incident note without changing diagnostic evidence.',
        'TypeError: Cannot read properties of undefined (reading "tools")',
        '    at segmentPrompt (packages/core/src/detok/prompt.ts:104:17)',
        '    at async compressPromptForLlm (file:///C:/src/utk/packages/core/src/detok/prompt.ts:55:9)',
        'Caused by: Error [ERR_MODULE_NOT_FOUND]: Cannot find package "@utk/core"'
      ].join('\n');

      const result = await compressPromptForLlm(prompt, {
        workspaceRoot: root,
        rate: 0.25
      });

      expect(result.compressedPrompt).toContain('TypeError: Cannot read properties of undefined (reading "tools")');
      expect(result.compressedPrompt).toContain('at segmentPrompt (packages/core/src/detok/prompt.ts:104:17)');
      expect(result.compressedPrompt).toContain('file:///C:/src/utk/packages/core/src/detok/prompt.ts:55:9');
      expect(result.compressedPrompt).toContain('Error [ERR_MODULE_NOT_FOUND]: Cannot find package "@utk/core"');
      expect(result.compressedPrompt).not.toContain('changing diagnostic evidence');
      expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'stack-trace')).toBe(true);
    } finally {
      if (previousFake === undefined) {
        delete process.env.UTK_DETOK_FAKE;
      } else {
        process.env.UTK_DETOK_FAKE = previousFake;
      }
    }
  });

  it('preserves markdown task and ordered lists', async () => {
    const previousFake = process.env.UTK_DETOK_FAKE;
    process.env.UTK_DETOK_FAKE = '1';
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-detoks-prompt-list-safe-'));
    try {
      const prompt = [
        'Compress surrounding prose but keep checklist state and numbering untouched.',
        '- [ ] Run `npm run build`',
        '- [x] Preserve `$schema` references',
        '1. Capture red failure',
        '2. Apply smallest fix',
        '10. Verify package-boundary sync'
      ].join('\n');

      const result = await compressPromptForLlm(prompt, {
        workspaceRoot: root,
        rate: 0.25
      });

      expect(result.compressedPrompt).toContain('- [ ] Run `npm run build`');
      expect(result.compressedPrompt).toContain('- [x] Preserve `$schema` references');
      expect(result.compressedPrompt).toContain('1. Capture red failure\n2. Apply smallest fix\n10. Verify package-boundary sync');
      expect(result.compressedPrompt).not.toContain('checklist state and numbering untouched');
      expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'list')).toBe(true);
    } finally {
      if (previousFake === undefined) {
        delete process.env.UTK_DETOK_FAKE;
      } else {
        process.env.UTK_DETOK_FAKE = previousFake;
      }
    }
  });

  it('preserves math blocks and inline formulas', async () => {
    const previousFake = process.env.UTK_DETOK_FAKE;
    process.env.UTK_DETOK_FAKE = '1';
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-detoks-prompt-math-safe-'));
    try {
      const prompt = [
        'Shorten this derivation prose while preserving mathematical notation exactly.',
        '$$',
        'score = \\frac{compressedTokens}{originalTokens} \\times 100',
        '$$',
        'Keep inline math $O(n \\log n)$ and threshold $rate <= 0.33$ unchanged.'
      ].join('\n');

      const result = await compressPromptForLlm(prompt, {
        workspaceRoot: root,
        rate: 0.25
      });

      expect(result.compressedPrompt).toContain('$$\nscore = \\frac{compressedTokens}{originalTokens} \\times 100\n$$');
      expect(result.compressedPrompt).toContain('$O(n \\log n)$');
      expect(result.compressedPrompt).toContain('$rate <= 0.33$');
      expect(result.compressedPrompt).not.toContain('preserving mathematical notation exactly');
      expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'math')).toBe(true);
    } finally {
      if (previousFake === undefined) {
        delete process.env.UTK_DETOK_FAKE;
      } else {
        process.env.UTK_DETOK_FAKE = previousFake;
      }
    }
  });

  it('preserves inline JSON, arrays, and TOML fragments', async () => {
    const previousFake = process.env.UTK_DETOK_FAKE;
    process.env.UTK_DETOK_FAKE = '1';
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-detoks-prompt-data-literal-safe-'));
    try {
      const prompt = [
        'Reduce explanatory words but keep literal config payloads exact.',
        'Use {"tools":["agent","read_file"],"metadata":{"owner":"detoks","strict":true}} as payload.',
        'Keep ["detoks-prompt","detok-mcp","ghcp-subagent"] ordered.',
        'Set [detok.prompt] model = "default/LLMLingua2" rate = 0.33.'
      ].join('\n');

      const result = await compressPromptForLlm(prompt, {
        workspaceRoot: root,
        rate: 0.25
      });

      expect(result.compressedPrompt).toContain('{"tools":["agent","read_file"],"metadata":{"owner":"detoks","strict":true}}');
      expect(result.compressedPrompt).toContain('["detoks-prompt","detok-mcp","ghcp-subagent"]');
      expect(result.compressedPrompt).toContain('[detok.prompt] model = "default/LLMLingua2" rate = 0.33');
      expect(result.compressedPrompt).not.toContain('literal config payloads exact');
      expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'data-literal')).toBe(true);
    } finally {
      if (previousFake === undefined) {
        delete process.env.UTK_DETOK_FAKE;
      } else {
        process.env.UTK_DETOK_FAKE = previousFake;
      }
    }
  });

  it('preserves multiline xml and jsx blocks', async () => {
    const previousFake = process.env.UTK_DETOK_FAKE;
    process.env.UTK_DETOK_FAKE = '1';
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-detoks-prompt-xml-jsx-safe-'));
    try {
      const prompt = [
        'Compress commentary but keep component markup byte stable.',
        '<Agent name="detoks-ghcp-subagent">',
        '  <Tools allowed="agent,read_file" />',
        '  <Handoff label="Implement Plan">{children}</Handoff>',
        '</Agent>',
        '<Button aria-label="Run detoks">Start</Button>'
      ].join('\n');

      const result = await compressPromptForLlm(prompt, {
        workspaceRoot: root,
        rate: 0.25
      });

      expect(result.compressedPrompt).toContain('<Agent name="detoks-ghcp-subagent">\n  <Tools allowed="agent,read_file" />\n  <Handoff label="Implement Plan">{children}</Handoff>\n</Agent>');
      expect(result.compressedPrompt).toContain('<Button aria-label="Run detoks">Start</Button>');
      expect(result.compressedPrompt).not.toContain('component markup byte stable');
      expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'html')).toBe(true);
    } finally {
      if (previousFake === undefined) {
        delete process.env.UTK_DETOK_FAKE;
      } else {
        process.env.UTK_DETOK_FAKE = previousFake;
      }
    }
  });

  it('preserves dot-env assignments and interpolation syntax', async () => {
    const previousFake = process.env.UTK_DETOK_FAKE;
    process.env.UTK_DETOK_FAKE = '1';
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-detoks-prompt-env-safe-'));
    try {
      const prompt = [
        'Shorten setup prose while keeping env examples unchanged.',
        'OPENAI_API_KEY=${OPENAI_API_KEY}',
        'NEXTAUTH_URL=http://localhost:3001',
        'DATABASE_URL=postgres://user:p%40ss@localhost:5432/langfuse?schema=public',
        'FEATURE_FLAGS=detoks,ghcp,agentsmd'
      ].join('\n');

      const result = await compressPromptForLlm(prompt, {
        workspaceRoot: root,
        rate: 0.25
      });

      expect(result.compressedPrompt).toContain('OPENAI_API_KEY=${OPENAI_API_KEY}');
      expect(result.compressedPrompt).toContain('NEXTAUTH_URL=http://localhost:3001');
      expect(result.compressedPrompt).toContain('DATABASE_URL=postgres://user:p%40ss@localhost:5432/langfuse?schema=public');
      expect(result.compressedPrompt).toContain('FEATURE_FLAGS=detoks,ghcp,agentsmd');
      expect(result.compressedPrompt).not.toContain('env examples unchanged');
      expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'config')).toBe(true);
    } finally {
      if (previousFake === undefined) {
        delete process.env.UTK_DETOK_FAKE;
      } else {
        process.env.UTK_DETOK_FAKE = previousFake;
      }
    }
  });

  it('preserves resource identifiers, digests, and uri schemes', async () => {
    const previousFake = process.env.UTK_DETOK_FAKE;
    process.env.UTK_DETOK_FAKE = '1';
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-detoks-prompt-resource-safe-'));
    try {
      const prompt = [
        'Reduce registry notes but keep deploy identifiers intact.',
        'Use docker.io/library/node:22-alpine@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.',
        'Mirror s3://utk-artifacts/runs/019c6e27/report.json and gs://bucket/path/to/object.ndjson.',
        'Keep urn:utk:detoks:prompt:v1 and vscode://file/C:/src/utk/packages/core/src/detok/prompt.ts:104:17.'
      ].join('\n');

      const result = await compressPromptForLlm(prompt, {
        workspaceRoot: root,
        rate: 0.25
      });

      expect(result.compressedPrompt).toContain('docker.io/library/node:22-alpine@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
      expect(result.compressedPrompt).toContain('s3://utk-artifacts/runs/019c6e27/report.json');
      expect(result.compressedPrompt).toContain('gs://bucket/path/to/object.ndjson');
      expect(result.compressedPrompt).toContain('urn:utk:detoks:prompt:v1');
      expect(result.compressedPrompt).toContain('vscode://file/C:/src/utk/packages/core/src/detok/prompt.ts:104:17');
      expect(result.compressedPrompt).not.toContain('deploy identifiers intact');
      expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'resource-id')).toBe(true);
    } finally {
      if (previousFake === undefined) {
        delete process.env.UTK_DETOK_FAKE;
      } else {
        process.env.UTK_DETOK_FAKE = previousFake;
      }
    }
  });

  it('preserves admonitions and definition lists', async () => {
    const previousFake = process.env.UTK_DETOK_FAKE;
    process.env.UTK_DETOK_FAKE = '1';
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-detoks-prompt-admonition-safe-'));
    try {
      const prompt = [
        'Compress the introduction but keep documentation callouts exactly formatted.',
        '!!! warning "Do not compress raw evidence"',
        '    Keep `.utk/events/run.json` verbatim until schema parsing finishes.',
        'Term',
        ': Definition with `detoks-prompt --stdin` and path C:\\src\\utk\\README.md.'
      ].join('\n');

      const result = await compressPromptForLlm(prompt, {
        workspaceRoot: root,
        rate: 0.25
      });

      expect(result.compressedPrompt).toContain('!!! warning "Do not compress raw evidence"\n    Keep `.utk/events/run.json` verbatim until schema parsing finishes.');
      expect(result.compressedPrompt).toContain('Term\n: Definition with `detoks-prompt --stdin` and path C:\\src\\utk\\README.md.');
      expect(result.compressedPrompt).not.toContain('documentation callouts exactly formatted');
      expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'admonition')).toBe(true);
      expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'definition-list')).toBe(true);
    } finally {
      if (previousFake === undefined) {
        delete process.env.UTK_DETOK_FAKE;
      } else {
        process.env.UTK_DETOK_FAKE = previousFake;
      }
    }
  });

  it('preserves git conflict markers', async () => {
    await withFakePromptCompression(
      'utk-detoks-prompt-conflict-safe-',
      [
        'Compress conflict explanation while preserving conflict payload.',
        '<<<<<<< HEAD',
        'const mode = "local";',
        '=======',
        'const mode = "remote";',
        '>>>>>>> origin/main'
      ].join('\n'),
      (result) => {
        expect(result.compressedPrompt).toContain('<<<<<<< HEAD\nconst mode = "local";\n=======\nconst mode = "remote";\n>>>>>>> origin/main');
        expect(result.compressedPrompt).not.toContain('preserving conflict payload');
        expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'conflict')).toBe(true);
      }
    );
  });

  it('preserves HTTP request and response transcripts', async () => {
    await withFakePromptCompression(
      'utk-detoks-prompt-http-safe-',
      [
        'Shorten network notes while keeping wire protocol exact.',
        'POST /v1/responses HTTP/1.1',
        'Host: api.openai.com',
        'Content-Type: application/json',
        '',
        'HTTP/1.1 429 Too Many Requests',
        'Retry-After: 2'
      ].join('\n'),
      (result) => {
        expect(result.compressedPrompt).toContain('POST /v1/responses HTTP/1.1\nHost: api.openai.com\nContent-Type: application/json');
        expect(result.compressedPrompt).toContain('HTTP/1.1 429 Too Many Requests\nRetry-After: 2');
        expect(result.compressedPrompt).not.toContain('wire protocol exact');
        expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'http')).toBe(true);
      }
    );
  });

  it('preserves SQL statements and parameter placeholders', async () => {
    await withFakePromptCompression(
      'utk-detoks-prompt-sql-safe-',
      [
        'Trim database rationale while preserving query shape.',
        'SELECT id, name FROM users WHERE email = $1 AND deleted_at IS NULL;',
        'EXPLAIN ANALYZE SELECT * FROM traces WHERE run_id = :runId;'
      ].join('\n'),
      (result) => {
        expect(result.compressedPrompt).toContain('SELECT id, name FROM users WHERE email = $1 AND deleted_at IS NULL;');
        expect(result.compressedPrompt).toContain('EXPLAIN ANALYZE SELECT * FROM traces WHERE run_id = :runId;');
        expect(result.compressedPrompt).not.toContain('preserving query shape');
        expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'sql')).toBe(true);
      }
    );
  });

  it('preserves GraphQL operations', async () => {
    await withFakePromptCompression(
      'utk-detoks-prompt-graphql-safe-',
      [
        'Compress API commentary but keep GraphQL operation unchanged.',
        'query GetAgent($id: ID!) {',
        '  agent(id: $id) { name tools { id kind } }',
        '}'
      ].join('\n'),
      (result) => {
        expect(result.compressedPrompt).toContain('query GetAgent($id: ID!) {\n  agent(id: $id) { name tools { id kind } }\n}');
        expect(result.compressedPrompt).not.toContain('GraphQL operation unchanged');
        expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'graphql')).toBe(true);
      }
    );
  });

  it('preserves cron expressions and schedules', async () => {
    await withFakePromptCompression(
      'utk-detoks-prompt-cron-safe-',
      [
        'Shorten scheduling explanation while keeping schedule literals exact.',
        'CRON_TZ=America/Chicago 15 3 * * 1-5 node scripts/nightly.mjs',
        '@reboot /usr/local/bin/utk-agent --once'
      ].join('\n'),
      (result) => {
        expect(result.compressedPrompt).toContain('CRON_TZ=America/Chicago 15 3 * * 1-5 node scripts/nightly.mjs');
        expect(result.compressedPrompt).toContain('@reboot /usr/local/bin/utk-agent --once');
        expect(result.compressedPrompt).not.toContain('schedule literals exact');
        expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'cron')).toBe(true);
      }
    );
  });

  it('preserves csv and tsv records', async () => {
    await withFakePromptCompression(
      'utk-detoks-prompt-delimited-safe-',
      [
        'Compress spreadsheet note while preserving delimited rows.',
        'name,score,notes',
        '"detoks, prompt",0.33,"keep comma"',
        'agent\tstatus\tlatency_ms',
        'ghcp\tgreen\t124'
      ].join('\n'),
      (result) => {
        expect(result.compressedPrompt).toContain('name,score,notes\n"detoks, prompt",0.33,"keep comma"');
        expect(result.compressedPrompt).toContain('agent\tstatus\tlatency_ms\nghcp\tgreen\t124');
        expect(result.compressedPrompt).not.toContain('preserving delimited rows');
        expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'delimited-data')).toBe(true);
      }
    );
  });

  it('preserves yaml object blocks outside frontmatter', async () => {
    await withFakePromptCompression(
      'utk-detoks-prompt-yaml-safe-',
      [
        'Condense deployment note while keeping YAML object exact.',
        'apiVersion: apps/v1',
        'kind: Deployment',
        'metadata:',
        '  name: detoks',
        'spec:',
        '  replicas: 2'
      ].join('\n'),
      (result) => {
        expect(result.compressedPrompt).toContain('apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: detoks\nspec:\n  replicas: 2');
        expect(result.compressedPrompt).not.toContain('keeping YAML object exact');
        expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'yaml')).toBe(true);
      }
    );
  });

  it('preserves Dockerfile instructions', async () => {
    await withFakePromptCompression(
      'utk-detoks-prompt-dockerfile-safe-',
      [
        'Compress container notes while preserving build recipe.',
        'FROM node:22-alpine',
        'WORKDIR /app',
        'COPY package*.json ./',
        'RUN npm ci --ignore-scripts',
        'CMD ["node","dist/server.js"]'
      ].join('\n'),
      (result) => {
        expect(result.compressedPrompt).toContain('FROM node:22-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci --ignore-scripts\nCMD ["node","dist/server.js"]');
        expect(result.compressedPrompt).not.toContain('preserving build recipe');
        expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'dockerfile')).toBe(true);
      }
    );
  });

  it('preserves timestamped log lines', async () => {
    await withFakePromptCompression(
      'utk-detoks-prompt-log-safe-',
      [
        'Shorten troubleshooting prose while preserving logs.',
        '2026-05-21T03:14:15.926Z ERROR detok failed code=EPIPE request_id=req_123',
        '[2026-05-21 03:14:16] WARN retry count=2 elapsed_ms=184'
      ].join('\n'),
      (result) => {
        expect(result.compressedPrompt).toContain('2026-05-21T03:14:15.926Z ERROR detok failed code=EPIPE request_id=req_123');
        expect(result.compressedPrompt).toContain('[2026-05-21 03:14:16] WARN retry count=2 elapsed_ms=184');
        expect(result.compressedPrompt).not.toContain('preserving logs');
        expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'log')).toBe(true);
      }
    );
  });

  it('preserves pem, jwt, and base64-like tokens', async () => {
    await withFakePromptCompression(
      'utk-detoks-prompt-secret-format-safe-',
      [
        'Compress security note while preserving token-shaped evidence.',
        '-----BEGIN PUBLIC KEY-----',
        'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtestkeydata',
        '-----END PUBLIC KEY-----',
        'JWT=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJkZXRva3MifQ.signature',
        'B64=U29tZSBsb25nIGRldG9rcyBwYXlsb2FkPT0='
      ].join('\n'),
      (result) => {
        expect(result.compressedPrompt).toContain('-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtestkeydata\n-----END PUBLIC KEY-----');
        expect(result.compressedPrompt).toContain('JWT=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJkZXRva3MifQ.signature');
        expect(result.compressedPrompt).toContain('B64=U29tZSBsb25nIGRldG9rcyBwYXlsb2FkPT0=');
        expect(result.compressedPrompt).not.toContain('token-shaped evidence');
        expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'secret-format')).toBe(true);
      }
    );
  });

  it('preserves network identifiers', async () => {
    await withFakePromptCompression(
      'utk-detoks-prompt-network-safe-',
      [
        'Compress networking note while preserving addresses.',
        'Allow 192.168.1.0/24, 10.0.0.5:5432, [2001:db8::1]:443, and MAC aa:bb:cc:dd:ee:ff.'
      ].join('\n'),
      (result) => {
        expect(result.compressedPrompt).toContain('192.168.1.0/24');
        expect(result.compressedPrompt).toContain('10.0.0.5:5432');
        expect(result.compressedPrompt).toContain('[2001:db8::1]:443');
        expect(result.compressedPrompt).toContain('aa:bb:cc:dd:ee:ff');
        expect(result.compressedPrompt).not.toContain('preserving addresses');
        expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'network-id')).toBe(true);
      }
    );
  });

  it('preserves css selectors and xpath locators', async () => {
    await withFakePromptCompression(
      'utk-detoks-prompt-selector-safe-',
      [
        'Reduce UI test commentary while preserving selectors.',
        'Click css=button[data-testid="submit"] > span.icon:first-child.',
        'Read xpath=//div[@role="dialog"]//button[contains(.,"Save")].'
      ].join('\n'),
      (result) => {
        expect(result.compressedPrompt).toContain('css=button[data-testid="submit"] > span.icon:first-child');
        expect(result.compressedPrompt).toContain('xpath=//div[@role="dialog"]//button[contains(.,"Save")]');
        expect(result.compressedPrompt).not.toContain('preserving selectors');
        expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'selector')).toBe(true);
      }
    );
  });

  it('preserves regular expressions and replacement patterns', async () => {
    await withFakePromptCompression(
      'utk-detoks-prompt-regex-safe-',
      [
        'Compress parser note while preserving regex forms.',
        'Use /^(?<name>[a-z][\\w-]+):\\s*(?<value>.+)$/g and replace with "$<name>=$<value>".',
        'PowerShell pattern: (?i)\\bdetoks-(prompt|skill)\\b'
      ].join('\n'),
      (result) => {
        expect(result.compressedPrompt).toContain('/^(?<name>[a-z][\\w-]+):\\s*(?<value>.+)$/g');
        expect(result.compressedPrompt).toContain('"$<name>=$<value>"');
        expect(result.compressedPrompt).toContain('(?i)\\bdetoks-(prompt|skill)\\b');
        expect(result.compressedPrompt).not.toContain('preserving regex forms');
        expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'regex')).toBe(true);
      }
    );
  });

  it('preserves semver ranges and constraints', async () => {
    await withFakePromptCompression(
      'utk-detoks-prompt-semver-safe-',
      [
        'Shorten dependency note while preserving constraints.',
        'Keep node >=20 <23, typescript ^5.8.3, vitest ~4.1.6, and package 1.2.3-beta.4+build.7.'
      ].join('\n'),
      (result) => {
        expect(result.compressedPrompt).toContain('>=20 <23');
        expect(result.compressedPrompt).toContain('^5.8.3');
        expect(result.compressedPrompt).toContain('~4.1.6');
        expect(result.compressedPrompt).toContain('1.2.3-beta.4+build.7');
        expect(result.compressedPrompt).not.toContain('preserving constraints');
        expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'version')).toBe(true);
      }
    );
  });

  it('preserves shell expansion syntax', async () => {
    await withFakePromptCompression(
      'utk-detoks-prompt-expansion-safe-',
      [
        'Compress shell note while preserving expansions.',
        'Use ${VAR:-fallback}, $(git rev-parse --show-toplevel), %USERPROFILE%, and $env:USERPROFILE.'
      ].join('\n'),
      (result) => {
        expect(result.compressedPrompt).toContain('${VAR:-fallback}');
        expect(result.compressedPrompt).toContain('$(git rev-parse --show-toplevel)');
        expect(result.compressedPrompt).toContain('%USERPROFILE%');
        expect(result.compressedPrompt).toContain('$env:USERPROFILE');
        expect(result.compressedPrompt).not.toContain('preserving expansions');
        expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'expansion')).toBe(true);
      }
    );
  });

  it('preserves keyboard chords and menu paths', async () => {
    await withFakePromptCompression(
      'utk-detoks-prompt-keyboard-safe-',
      [
        'Compress UX note while preserving shortcuts.',
        'Press Ctrl+Shift+P, Alt+F4, Cmd+K Cmd+S, then choose File > Preferences > Settings.'
      ].join('\n'),
      (result) => {
        expect(result.compressedPrompt).toContain('Ctrl+Shift+P');
        expect(result.compressedPrompt).toContain('Alt+F4');
        expect(result.compressedPrompt).toContain('Cmd+K Cmd+S');
        expect(result.compressedPrompt).toContain('File > Preferences > Settings');
        expect(result.compressedPrompt).not.toContain('preserving shortcuts');
        expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'keyboard')).toBe(true);
      }
    );
  });

  it('preserves ansi escape sequences and terminal prompt lines', async () => {
    await withFakePromptCompression(
      'utk-detoks-prompt-ansi-safe-',
      [
        'Shorten terminal note while preserving escape-coded output.',
        '\u001b[31mFAIL\u001b[0m packages/core/test/detokPrompt.test.ts',
        'PS C:\\src\\utk> npm test'
      ].join('\n'),
      (result) => {
        expect(result.compressedPrompt).toContain('\u001b[31mFAIL\u001b[0m packages/core/test/detokPrompt.test.ts');
        expect(result.compressedPrompt).toContain('PS C:\\src\\utk> npm test');
        expect(result.compressedPrompt).not.toContain('escape-coded output');
        expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'terminal')).toBe(true);
      }
    );
  });

  it('preserves version-control refs and compare ranges', async () => {
    await withFakePromptCompression(
      'utk-detoks-prompt-vcs-ref-safe-',
      [
        'Compress release note while preserving refs.',
        'Compare main..codex/detoks-hardening, HEAD~2, refs/heads/main, tag v1.2.3, and commit abc1234^!'
      ].join('\n'),
      (result) => {
        expect(result.compressedPrompt).toContain('main..codex/detoks-hardening');
        expect(result.compressedPrompt).toContain('HEAD~2');
        expect(result.compressedPrompt).toContain('refs/heads/main');
        expect(result.compressedPrompt).toContain('v1.2.3');
        expect(result.compressedPrompt).toContain('abc1234^!');
        expect(result.compressedPrompt).not.toContain('preserving refs');
        expect(result.segments.some((segment) => segment.kind === 'protected' && segment.reason === 'vcs-ref')).toBe(true);
      }
    );
  });
});
