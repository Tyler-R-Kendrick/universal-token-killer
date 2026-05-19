import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  canonicalJson,
  buildStructuredInvocationGrammar,
  completeStructuredToolInvocation,
  contentHash,
  curryTool,
  inferFieldGrammar,
  loadFieldGrammar,
  memoizeTool,
  mergeFieldGrammar,
  normalizeWithFieldGrammar,
  optimizeStructuredToolArgs,
  recordFieldObservation
} from '../src/index.js';

describe('structured tooling', () => {
  it('completes registered tools with grammar templates and cache metadata', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-structured-tool-'));
    const result = await completeStructuredToolInvocation({
      workspaceRoot,
      request: 'search open issues by label',
      tools: [
        {
          toolId: 'tool.search',
          description: 'search open issues',
          outputCache: true,
          bypassOnCache: true,
          parameters: [{ name: 'query', required: true, completions: ['alpha:open alpha:label'] }]
        },
        {
          toolId: 'tool.query',
          description: 'query issues',
          parameters: [{ name: 'expr', required: true, completions: ['select alpha beta'] }]
        }
      ]
    });

    expect(result.invocation.toolId).toBe('tool.search');
    expect(result.invocation.args.query).toBe('alpha:open alpha:label');
    expect(result.cache.eligible).toBe(true);
    expect(result.cache.hit).toBe(false);
    expect(result.cache.bypass).toBe(false);
    expect(result.serializerId).toBe('toon');
    expect(result.guidance.used).toBe(true);
    expect(result.guidance.available).toBe(false);
    expect(result.templatePath.endsWith('structured-template.compact.toon')).toBe(true);
    expect(await readFile(result.templatePath, 'utf8')).toContain('tool.search');
  });

  it('returns cache hits and bypass flags for memoized curried invocation planning', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-structured-cache-'));
    const tools = [
      {
        toolId: 'tool.cache',
        outputCache: true,
        bypassOnCache: true,
        parameters: [{ name: 'expr', required: true, completions: ['select alpha where state = open'] }]
      }
    ];

    const first = await completeStructuredToolInvocation({
      workspaceRoot,
      request: 'run expr for open alpha',
      tools
    });
    const second = await completeStructuredToolInvocation({
      workspaceRoot,
      request: 'run expr for open alpha',
      tools
    });

    expect(first.cache.hit).toBe(false);
    expect(second.cache.hit).toBe(true);
    expect(second.cache.bypass).toBe(true);
    expect(second.cache.path).toBe(first.cache.path);
  });

  it('supports tool registry defaults loaded from config', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-structured-config-defaults-'));
    await mkdir(path.join(workspaceRoot, '.utk'), { recursive: true });
    await writeFile(
      path.join(workspaceRoot, '.utk', 'config.toml'),
      [
        '[serialization]',
        'default = "toon"',
        '',
        '[[tools.registry]]',
        'tool = "tool.regfield"',
        'description = "registered field lookup"',
        'output_cache = true',
        'bypass_on_cache = true',
        '',
        '[[tools.registry.structured_fields]]',
        'name = "pattern"',
        'completions = ["alpha beta"]',
        'required = true',
        ''
      ].join('\n'),
      'utf8'
    );

    const result = await completeStructuredToolInvocation({
      workspaceRoot,
      request: 'use registered field lookup',
      tools: [{ toolId: 'tool.regfield', parameters: [{ name: 'scope', completions: ['repo'], required: true }] }]
    });

    expect(result.invocation.args.pattern).toBe('alpha beta');
    expect(result.invocation.args.scope).toBe('repo');
    expect(result.cache.eligible).toBe(true);
    expect(result.missingRequired).toEqual([]);
  });

  it('reports missing required fields and rejects empty tool sets', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-structured-missing-'));
    const missing = await completeStructuredToolInvocation({
      workspaceRoot,
      request: 'unknown prompt',
      tools: [{ toolId: 'tool.query', parameters: [{ name: 'expr', required: true, completions: [] }] }]
    });
    expect(missing.missingRequired).toEqual(['expr']);
    expect(missing.confidence).toBeLessThan(1);
    const sparse = await completeStructuredToolInvocation({
      workspaceRoot,
      request: 'unknown sparse',
      tools: [{ toolId: 'tool.sparse', parameters: [{ name: 'hole', required: true, completions: [undefined as unknown as string] }] }]
    });
    expect(sparse.missingRequired).toEqual(['hole']);
    const punctuation = await completeStructuredToolInvocation({
      workspaceRoot,
      request: 'literal',
      tools: [{ toolId: 'tool.punctuation', parameters: [{ name: 'value', completions: ['!!!'] }] }]
    });
    expect(punctuation.invocation.args).toEqual({});
    const descriptionEmpty = await completeStructuredToolInvocation({
      workspaceRoot,
      request: 'mystery mode',
      tools: [{ toolId: 'tool.description-empty', parameters: [{ name: 'mode', completions: [undefined as unknown as string], description: 'mystery mode' }] }]
    });
    expect(descriptionEmpty.invocation.args).toEqual({});
    const descriptionOnly = await completeStructuredToolInvocation({
      workspaceRoot,
      request: 'configure foo bar baz',
      tools: [{ toolId: 'tool.description-only', parameters: [{ name: 'mode', completions: ['quick brown'], description: 'foo bar' }] }]
    });
    expect(descriptionOnly.invocation.args.mode).toBe('quick brown');
    await expect(completeStructuredToolInvocation({ workspaceRoot, request: 'x', tools: [] })).rejects.toThrow(
      'At least one structured tool definition is required'
    );
  });

  it('builds grammar even when no completions exist', async () => {
    const grammar = buildStructuredInvocationGrammar([{ toolId: 'tool.none', parameters: [] }]);
    expect(JSON.stringify(grammar.serialize())).toContain('tool.none');

    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-structured-select-'));
    const selected = await completeStructuredToolInvocation({
      workspaceRoot,
      request: 'pick described option',
      tools: [
        { toolId: 'tool.raw', parameters: [{ name: 'value', completions: ['raw'] }] },
        { toolId: 'tool.described', description: 'pick described option', parameters: [{ name: 'value', completions: ['described'] }] }
      ]
    });
    expect(selected.invocation.toolId).toBe('tool.described');

    const unmatchedDescription = await completeStructuredToolInvocation({
      workspaceRoot,
      request: 'no related terms',
      tools: [{ toolId: 'tool.no-match', parameters: [{ name: 'mode', completions: ['safe'], description: 'safe mode' }] }]
    });
    expect(unmatchedDescription.invocation.args).toEqual({});
  });

  it('optimizes structured field values without mutating unknown or non-string fields', () => {
    const result = optimizeStructuredToolArgs(
      {
        first: '  alpha,beta   gamma  ',
        second: '   keep   short  ',
        third: '  many   spaces  ',
        count: 7,
        untouched: 7
      },
      {
        parameters: [
          { name: 'first', completions: ['alpha,beta gamma'] },
          { name: 'second', completions: ['keep short'] },
          { name: 'third', completions: [] },
          { name: 'count', completions: ['7'] }
        ]
      }
    );
    expect(result.applied).toBe(true);
    expect(result.value.first).toBe('alpha,beta gamma');
    expect(result.value.second).toBe('keep short');
    expect(result.value.third).toBe('many spaces');
    expect(result.value.count).toBe(7);
    expect(result.value.untouched).toBe(7);
  });

  it('exposes curry and memoize functors as composable wrappers', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-structured-functor-'));
    const base = async (input: { left: string; right: string }) => `${input.left}:${input.right}`;
    const curried = curryTool(base, { left: 'preset' });
    const memoized = memoizeTool({
      workspaceRoot,
      cacheNamespace: 'functors',
      cacheKeyPrefix: 'pair',
      enabled: true,
      tool: curried
    });

    const first = await memoized({ left: 'ignored', right: 'value' });
    const second = await memoized({ left: 'ignored', right: 'value' });

    expect(first.value).toBe('ignored:value');
    expect(first.cacheHit).toBe(false);
    expect(second.cacheHit).toBe(true);
    expect(second.cachePath).toBe(first.cachePath);

    const disabledMemo = memoizeTool({
      workspaceRoot,
      cacheNamespace: 'functors',
      cacheKeyPrefix: 'disabled',
      enabled: false,
      tool: curried
    });
    const disabled = await disabledMemo({ left: 'kept', right: 'now' });
    expect(disabled.cacheHit).toBe(false);

    const invalidInput = { left: 'ignored', right: 'value' };
    const invalidKey = contentHash(`pair-invalid:${canonicalJson(invalidInput)}`);
    const invalidPath = path.join(workspaceRoot, '.utk', 'cache', 'functors-invalid', `${invalidKey}.json`);
    await mkdir(path.dirname(invalidPath), { recursive: true });
    await writeFile(invalidPath, '{}', 'utf8');
    const invalidMemo = memoizeTool({
      workspaceRoot,
      cacheNamespace: 'functors-invalid',
      cacheKeyPrefix: 'pair-invalid',
      enabled: true,
      tool: curried
    });
    const invalidCache = await invalidMemo(invalidInput);
    expect(invalidCache.cacheHit).toBe(false);
  });

  it('learns field grammars from observations and applies them on subsequent invocations', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-structured-learn-'));
    const toolId = 'tool.learner';

    await recordFieldObservation(workspaceRoot, toolId, 'expr', 'alpha:one alpha:two');
    await recordFieldObservation(workspaceRoot, toolId, 'expr', 'beta:three beta:four');
    await recordFieldObservation(workspaceRoot, toolId, 'expr', 'gamma:five gamma:six');

    const learned = await loadFieldGrammar(workspaceRoot, toolId, 'expr');
    expect(learned).toBeDefined();
    expect(learned?.observations).toBe(3);
    expect(learned?.separators[':']?.tight).toBeGreaterThan(0);

    const optimized = optimizeStructuredToolArgs(
      { expr: '  delta : seven   delta : eight  ' },
      { parameters: [{ name: 'expr' }] },
      { expr: learned }
    );
    expect(optimized.applied).toBe(true);
    expect(optimized.value.expr).toBe('delta:seven delta:eight');
  });

  it('infers and merges field grammars deterministically', () => {
    const first = inferFieldGrammar('a:b c:d');
    expect(first.observations).toBe(1);
    expect(first.separators[':']?.tight).toBe(2);
    expect(first.separators[':']?.loose).toBe(0);

    const second = inferFieldGrammar('a : b c : d');
    expect(second.separators[':']?.tight).toBe(0);
    expect(second.separators[':']?.loose).toBe(2);

    const merged = mergeFieldGrammar(first, second);
    expect(merged.observations).toBe(2);
    expect(merged.separators[':']?.tight).toBe(2);
    expect(merged.separators[':']?.loose).toBe(2);

    const fromEmpty = mergeFieldGrammar(undefined, first);
    expect(fromEmpty.version).toBe(1);
    expect(fromEmpty.observations).toBe(1);

    const leading = inferFieldGrammar(':abc');
    expect(leading.separators[':']?.loose).toBe(1);
    const trailing = inferFieldGrammar('abc?');
    expect(trailing.separators['?']?.loose).toBe(1);

    const distinct = mergeFieldGrammar(first, inferFieldGrammar('a=b'));
    expect(distinct.separators['=']?.tight).toBe(1);

    expect(normalizeWithFieldGrammar('  x   y  ', undefined)).toBe('x y');
    expect(normalizeWithFieldGrammar('a : b', merged)).toBe('a : b');
    const tightOnly = mergeFieldGrammar(first, first);
    expect(normalizeWithFieldGrammar('a : b', tightOnly)).toBe('a:b');
  });

  it('treats parameters without a completions array as optional and ignores malformed grammar files', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-structured-edges-'));

    const noCompletions = await completeStructuredToolInvocation({
      workspaceRoot,
      request: 'no completions provided',
      tools: [
        { toolId: 'tool.no-completions', parameters: [{ name: 'value' }] },
        { toolId: 'tool.no-completions.peer', parameters: [{ name: 'other' }] }
      ]
    });
    expect(noCompletions.invocation.args).toEqual({});

    const grammarDir = path.join(workspaceRoot, '.utk', 'tools', 'tool-malformed', 'fields');
    await mkdir(grammarDir, { recursive: true });
    await writeFile(path.join(grammarDir, 'value.grammar.json'), '{"junk":true}', 'utf8');
    const reloaded = await loadFieldGrammar(workspaceRoot, 'tool.malformed', 'value');
    expect(reloaded).toBeUndefined();

    const result = await completeStructuredToolInvocation({
      workspaceRoot,
      request: 'use literal value',
      tools: [{ toolId: 'tool.malformed', parameters: [{ name: 'value', required: true, completions: ['literal'] }] }]
    });
    expect(result.invocation.args.value).toBe('literal');
  });
});
