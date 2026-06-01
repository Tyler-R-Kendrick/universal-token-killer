import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  loadUtkConfig,
  matchToolInvocation,
  createLocalToolEmbeddingProviderAdapter,
  type LocalToolEmbeddingProviderAdapter,
  type LocalToolEmbeddingProvider,
  type ToolMatchingLevel
} from '../src/index.js';
import {
  toolMatchingNegativeCases,
  toolMatchingPositiveCases,
  toolMatchingTools,
  type ToolMatchingLevelName
} from './fixtures/toolMatchingCorpus.js';

describe('lexical tool matching', () => {
  it('ships a broad deterministic corpus', () => {
    expect(toolMatchingPositiveCases.length).toBeGreaterThanOrEqual(300);
    expect(toolMatchingNegativeCases.length).toBeGreaterThanOrEqual(200);
    expect(toolMatchingPositiveCases).toEqual(expect.arrayContaining([
      expect.objectContaining({ input: '/run_tests --pattern unit', expectedTool: 'run_tests' }),
      expect.objectContaining({ input: 'find TODO in src', expectedTool: 'grep' }),
      expect.objectContaining({ input: 'read package json', expectedTool: 'read_file' }),
      expect.objectContaining({ input: 'open https://example.com', expectedTool: 'fetch' })
    ]));
    expect(toolMatchingNegativeCases).toEqual(expect.arrayContaining([
      expect.objectContaining({ input: 'do not run tests' }),
      expect.objectContaining({ input: 'explain how to edit files' }),
      expect.objectContaining({ input: 'search project' })
    ]));
  });

  it('selects expected tools for positive corpus and fails open for negatives', async () => {
    const workspaceRoot = await writeConfig('lexical-similarity');
    const config = await loadUtkConfig(workspaceRoot);

    for (const item of toolMatchingPositiveCases) {
      const result = await matchToolInvocation({ workspaceRoot, request: item.input, tools: toolMatchingTools, config });
      expect(result, item.input).toMatchObject({ kind: 'match', toolName: item.expectedTool });
      if (item.expectedArgs) {
        expect(result.kind === 'match' ? result.args : {}, item.input).toMatchObject(item.expectedArgs);
      }
    }

    for (const item of toolMatchingNegativeCases) {
      const result = await matchToolInvocation({ workspaceRoot, request: item.input, tools: toolMatchingTools, config });
      expect(result.kind, item.input).not.toBe('match');
    }
  }, 20000);

  it('honors matching level enum from slash through lexical similarity', async () => {
    const cases: Array<{ level: ToolMatchingLevelName; request: string; shouldMatch: boolean; expectedReason?: string }> = [
      { level: 'slash-commands', request: '/run_tests --pattern unit', shouldMatch: true, expectedReason: 'slash-command' },
      { level: 'slash-commands', request: 'run tests', shouldMatch: false },
      { level: 'exact-lexical-match', request: 'run tests', shouldMatch: true, expectedReason: 'exact-lexical-match' },
      { level: 'exact-lexical-match', request: 'please run tests', shouldMatch: false },
      { level: 'regex-patterns', request: 'please run vitest tests', shouldMatch: true, expectedReason: 'regex-pattern' },
      { level: 'regex-patterns', request: 'runn tests', shouldMatch: false },
      { level: 'lexical-similarity', request: 'runn tests', shouldMatch: true, expectedReason: 'lexical-similarity' }
    ];

    for (const item of cases) {
      const workspaceRoot = await writeConfig(item.level);
      const result = await matchToolInvocation({ workspaceRoot, request: item.request, tools: toolMatchingTools });
      if (item.shouldMatch) {
        expect(result, item.request).toMatchObject({ kind: 'match', toolName: 'run_tests', reason: item.expectedReason });
      } else {
        expect(result.kind, item.request).not.toBe('match');
      }
    }
  });

  it('captures exact-match argument tails across spacing and JSON punctuation', async () => {
    const workspaceRoot = await writeConfig('exact-lexical-match');
    const result = await matchToolInvocation({
      workspaceRoot,
      request: 'Run    tests {"pattern":"spaced-json","suite":"smoke"}',
      tools: toolMatchingTools
    });

    expect(result).toMatchObject({
      kind: 'match',
      toolName: 'run_tests',
      reason: 'exact-lexical-match',
      args: { pattern: 'spaced-json', suite: 'smoke' }
    });
  });

  it('lets config add aliases, regexes, default args, and protected bypass rules', async () => {
    const workspaceRoot = await writeConfig('regex-patterns', [
      '',
      '[[tools.registry]]',
      'tool = "read_file"',
      'lexical_aliases = ["inspect file"]',
      'lexical_regexes = ["^peek at (?<path>\\\\S+)$"]',
      'default_args = { path = "README.md" }',
      '',
      '[[tools.registry]]',
      'tool = "edit_file"',
      'bypass_on_match = true',
      'lexical_regexes = ["^safely edit (?<path>\\\\S+) from (?<old_string>\\\\S+) to (?<new_string>\\\\S+)$"]',
      '',
      '[model_proxy]',
      'protected_tools = ["edit_file"]',
      'deny_tools = ["delete_file"]'
    ].join('\n'));

    const alias = await matchToolInvocation({ workspaceRoot, request: 'inspect file', tools: toolMatchingTools });
    expect(alias).toMatchObject({ kind: 'match', toolName: 'read_file', args: { path: 'README.md' } });

    const regex = await matchToolInvocation({ workspaceRoot, request: 'peek at package.json', tools: toolMatchingTools });
    expect(regex).toMatchObject({ kind: 'match', toolName: 'read_file', args: { path: 'package.json' } });

    const protectedNatural = await matchToolInvocation({ workspaceRoot, request: 'edit file package.json', tools: toolMatchingTools });
    expect(protectedNatural).toMatchObject({ kind: 'miss', reason: 'protected-tool' });

    const protectedRegex = await matchToolInvocation({ workspaceRoot, request: 'safely edit package.json from old to new', tools: toolMatchingTools });
    expect(protectedRegex).toMatchObject({
      kind: 'match',
      toolName: 'edit_file',
      args: { path: 'package.json', old_string: 'old', new_string: 'new' }
    });

    const denied = await matchToolInvocation({ workspaceRoot, request: '/delete_file --path tmp.txt', tools: toolMatchingTools });
    expect(denied).toMatchObject({ kind: 'miss', reason: 'denied-tool' });

    const deniedNatural = await matchToolInvocation({ workspaceRoot, request: 'delete file tmp.txt', tools: toolMatchingTools });
    expect(deniedNatural).toMatchObject({ kind: 'miss', reason: 'denied-tool' });
  });

  it('prefers local embedding matches when available and fails open when unavailable or broken', async () => {
    const workspaceRoot = await writeConfig('lexical-similarity', [
      'prefer_local_embeddings = true',
      'embedding_similarity_threshold = 0.75',
      'winner_gap = 0.10'
    ].join('\n'));

    const embeddingProvider: LocalToolEmbeddingProvider = {
      id: 'mock-local',
      model: 'mock-embedding',
      dimensions: 2,
      async probe() {
        return { available: true, reason: 'ok' };
      },
      async embed(texts) {
        return texts.map((text) => {
          if (text.includes('send_email')) return [1, 0];
          if (text.includes('grep')) return [0, 1];
          return [1, 0];
        });
      }
    };

    const result = await matchToolInvocation({
      workspaceRoot,
      request: 'search project files for ada@example.com',
      tools: [toolMatchingTools[1], toolMatchingTools[9]],
      embeddingProvider
    });
    expect(result).toMatchObject({ kind: 'match', toolName: 'send_email', reason: 'embedding' });

    const unavailable: LocalToolEmbeddingProvider = {
      ...embeddingProvider,
      async probe() {
        return { available: false, reason: 'offline' };
      }
    };
    const ambiguous = await matchToolInvocation({
      workspaceRoot,
      request: 'search project',
      tools: [toolMatchingTools[1], toolMatchingTools[8]],
      embeddingProvider: unavailable
    });
    expect(ambiguous).toMatchObject({ kind: 'miss', reason: 'ambiguous' });

    const broken: LocalToolEmbeddingProvider = {
      ...embeddingProvider,
      async embed() {
        throw new Error('local embedding died');
      }
    };
    const fallback = await matchToolInvocation({
      workspaceRoot,
      request: 'run vitest tests',
      tools: toolMatchingTools,
      embeddingProvider: broken
    });
    expect(fallback).toMatchObject({ kind: 'match', toolName: 'run_tests', reason: 'exact-lexical-match' });

    const skippedBrokenProbe = await matchToolInvocation({
      workspaceRoot,
      request: 'search project files for ada@example.com',
      tools: [toolMatchingTools[1], toolMatchingTools[9]],
      embeddingProviders: [
        {
          ...embeddingProvider,
          id: 'broken-probe',
          async probe() {
            throw new Error('probe failed');
          }
        },
        embeddingProvider
      ]
    });
    expect(skippedBrokenProbe).toMatchObject({ kind: 'match', toolName: 'send_email', reason: 'embedding' });
  });

  it('resolves local embedding providers through injectable adapters with provider-owned options', async () => {
    type CustomLocalEmbeddingOptions = {
      model: string;
      dimensions: number;
      preferredTool: string;
    };
    const workspaceRoot = await writeConfig('lexical-similarity', [
      'prefer_local_embeddings = true',
      'embedding_similarity_threshold = 0.75',
      'winner_gap = 0.10',
      'providers = ["custom-local"]',
      '',
      '[tool_matching.provider_options.custom-local]',
      'model = "custom-embedding"',
      'dimensions = 2',
      'preferred_tool = "send_email"'
    ].join('\n'));
    const config = await loadUtkConfig(workspaceRoot);

    const customAdapter: LocalToolEmbeddingProviderAdapter<CustomLocalEmbeddingOptions> = createLocalToolEmbeddingProviderAdapter({
      id: 'custom-local',
      optionsFromConfig(options) {
        return {
          model: String(options.model ?? 'custom-embedding'),
          dimensions: typeof options.dimensions === 'number' ? options.dimensions : 2,
          preferredTool: String(options.preferred_tool ?? 'send_email')
        };
      },
      create(options) {
        return {
          id: 'custom-local',
          model: options.model,
          dimensions: options.dimensions,
          async probe() {
            return { available: true, reason: 'ok' };
          },
          async embed(texts) {
            return texts.map((text) => text.includes(options.preferredTool) || text.includes('ada@example.com') ? [1, 0] : [0, 1]);
          }
        };
      }
    });

    const result = await matchToolInvocation({
      workspaceRoot,
      request: 'search project files for ada@example.com',
      tools: [toolMatchingTools[1], toolMatchingTools[9]],
      config,
      embeddingProviderAdapters: [customAdapter]
    });

    expect(result).toMatchObject({ kind: 'match', toolName: 'send_email', reason: 'embedding' });
  });

  it('rejects unsafe configured regexes and keeps candidate order stable', async () => {
    const workspaceRoot = await writeConfig('regex-patterns', [
      '',
      '[[tools.registry]]',
      'tool = "run_tests"',
      'lexical_regexes = ["^(a+)+$"]',
      '',
      '[[tools.registry]]',
      'tool = "read_file"',
      'lexical_regexes = ["(", "^peek (?<path>\\\\S+)$"]'
    ].join('\n'));

    const unsafe = await matchToolInvocation({ workspaceRoot, request: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa!', tools: toolMatchingTools });
    expect(unsafe.kind).not.toBe('match');

    const forward = await matchToolInvocation({ workspaceRoot, request: 'run vitest tests', tools: toolMatchingTools });
    const reverse = await matchToolInvocation({ workspaceRoot, request: 'run vitest tests', tools: [...toolMatchingTools].reverse() });
    expect(forward).toMatchObject({ kind: 'match', toolName: 'run_tests' });
    expect(reverse).toMatchObject({ kind: 'match', toolName: 'run_tests' });

    const validAfterInvalid = await matchToolInvocation({ workspaceRoot, request: 'peek package.json', tools: toolMatchingTools });
    expect(validAfterInvalid).toMatchObject({ kind: 'match', toolName: 'read_file', args: { path: 'package.json' } });
  });

  it('normalizes tool matching config defaults', async () => {
    const workspaceRoot = await writeConfig('regex-patterns', [
      'prefer_local_embeddings = true',
      'embedding_timeout_ms = 123',
      '',
      '[[tools.registry]]',
      'tool = "run_tests"',
      'lexical_aliases = ["test runner"]',
      'lexical_regexes = ["^ship tests$"]',
      'bypass_on_match = true',
      'default_args = { pattern = "unit" }'
    ].join('\n'));

    const config = await loadUtkConfig(workspaceRoot);
    expect(config.tool_matching).toMatchObject({
      enabled: true,
      level: 'regex-patterns' satisfies ToolMatchingLevel,
      prefer_local_embeddings: true,
      embedding_timeout_ms: 123
    });
    expect(config.tools.registry[0]).toMatchObject({
      lexical_aliases: ['test runner'],
      lexical_regexes: ['^ship tests$'],
      bypass_on_match: true,
      default_args: { pattern: 'unit' }
    });
  });
});

async function writeConfig(level: ToolMatchingLevelName, extra = ''): Promise<string> {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-tool-matching-'));
  await mkdir(path.join(workspaceRoot, '.utk'), { recursive: true });
  const config = [
    '[serialization]',
    'default = "toon"',
    '',
    '[tool_matching]',
    'enabled = true',
    `level = "${level}"`,
    ...defaultToolMatchingLines(extra),
    extra,
    ''
  ].join('\n');
  await writeFile(path.join(workspaceRoot, '.utk', 'config.toml'), config, 'utf8');
  return workspaceRoot;
}

function defaultToolMatchingLines(extra: string): string[] {
  const lines: string[] = [];
  if (!/\bprefer_local_embeddings\s*=/.test(extra)) lines.push('prefer_local_embeddings = false');
  if (!/\blexical_similarity_threshold\s*=/.test(extra)) lines.push('lexical_similarity_threshold = 0.50');
  if (!/\bexact_similarity_threshold\s*=/.test(extra)) lines.push('exact_similarity_threshold = 0.98');
  if (!/\bembedding_similarity_threshold\s*=/.test(extra)) lines.push('embedding_similarity_threshold = 0.78');
  if (!/\bwinner_gap\s*=/.test(extra)) lines.push('winner_gap = 0.06');
  return lines;
}
