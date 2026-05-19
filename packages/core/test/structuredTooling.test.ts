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
  memoizeTool,
  optimizeStructuredToolArgs
} from '../src/index.js';

describe('structured tooling', () => {
  it('completes registered non-cli tools with grammar templates and cache metadata', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-structured-tool-'));
    const result = await completeStructuredToolInvocation({
      workspaceRoot,
      request: 'search open issues by label',
      tools: [
        {
          toolId: 'github.search.issues',
          description: 'search open issues',
          outputCache: true,
          bypassOnCache: true,
          parameters: [{ name: 'query', grammar: 'lucene', required: true, completions: ['is:issue is:open label:bug'] }]
        },
        {
          toolId: 'db.query',
          description: 'query issues with sql',
          parameters: [{ name: 'sql', grammar: 'sql', required: true, completions: ['select * from issues'] }]
        }
      ]
    });

    expect(result.invocation.toolId).toBe('github.search.issues');
    expect(result.invocation.args.query).toBe('is:issue is:open label:bug');
    expect(result.cache.eligible).toBe(true);
    expect(result.cache.hit).toBe(false);
    expect(result.cache.bypass).toBe(false);
    expect(result.serializerId).toBe('toon');
    expect(result.guidance.used).toBe(true);
    expect(result.guidance.available).toBe(false);
    expect(result.templatePath.endsWith('structured-template.compact.toon')).toBe(true);
    expect(await readFile(result.templatePath, 'utf8')).toContain('github.search.issues');
  });

  it('returns cache hits and bypass flags for memoized curried invocation planning', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-structured-cache-'));
    const tools = [
      {
        toolId: 'db.query',
        outputCache: true,
        bypassOnCache: true,
        parameters: [{ name: 'sql', grammar: 'sql' as const, required: true, completions: ['select * from issues where state = open'] }]
      }
    ];

    const first = await completeStructuredToolInvocation({
      workspaceRoot,
      request: 'run sql for open issues',
      tools
    });
    const second = await completeStructuredToolInvocation({
      workspaceRoot,
      request: 'run sql for open issues',
      tools
    });

    expect(first.cache.hit).toBe(false);
    expect(second.cache.hit).toBe(true);
    expect(second.cache.bypass).toBe(true);
    expect(second.cache.path).toBe(first.cache.path);
  });

  it('supports tool registry defaults loaded from config', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-structured-config-defaults-'));
    await import('node:fs/promises').then((fs) => fs.mkdir(path.join(workspaceRoot, '.utk'), { recursive: true }));
    await writeFile(
      path.join(workspaceRoot, '.utk', 'config.toml'),
      [
        '[serialization]',
        'default = "toon"',
        '',
        '[[tools.registry]]',
        'tool = "search.regex"',
          'description = "regex lookup"',
          'output_cache = true',
          'bypass_on_cache = true',
        '',
        '[[tools.registry.structured_fields]]',
        'name = "pattern"',
        'grammar = "regex"',
        'completions = ["foo\\\\s+bar"]',
        'required = true',
        ''
      ].join('\n'),
      'utf8'
    );

    const result = await completeStructuredToolInvocation({
      workspaceRoot,
      request: 'use regex lookup',
      tools: [{ toolId: 'search.regex', parameters: [{ name: 'scope', grammar: 'bash-like', completions: ['repo'], required: true }] }]
    });

    expect(result.invocation.args.pattern).toBe('foo\\s+bar');
    expect(result.invocation.args.scope).toBe('repo');
    expect(result.cache.eligible).toBe(true);
    expect(result.missingRequired).toEqual([]);
  });

  it('reports missing required fields and rejects empty tool sets', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-structured-missing-'));
    const missing = await completeStructuredToolInvocation({
      workspaceRoot,
      request: 'unknown prompt',
      tools: [{ toolId: 'db.query', parameters: [{ name: 'sql', grammar: 'sql', required: true, completions: [] }] }]
    });
    expect(missing.missingRequired).toEqual(['sql']);
    expect(missing.confidence).toBeLessThan(1);
    const descriptionFallback = await completeStructuredToolInvocation({
      workspaceRoot,
      request: 'safe mode please',
      tools: [{ toolId: 'tool.desc', parameters: [{ name: 'mode', grammar: 'bash-like', required: true, completions: ['safe'], description: 'safe mode' }] }]
    });
    expect(descriptionFallback.invocation.args.mode).toBe('safe');
    const sparse = await completeStructuredToolInvocation({
      workspaceRoot,
      request: 'unknown sparse',
      tools: [{ toolId: 'tool.sparse', parameters: [{ name: 'hole', grammar: 'bash-like', required: true, completions: [undefined as unknown as string] }] }]
    });
    expect(sparse.missingRequired).toEqual(['hole']);
    const punctuation = await completeStructuredToolInvocation({
      workspaceRoot,
      request: 'literal',
      tools: [{ toolId: 'tool.punctuation', parameters: [{ name: 'value', grammar: 'bash-like', completions: ['!!!'] }] }]
    });
    expect(punctuation.invocation.args).toEqual({});
    const descriptionEmpty = await completeStructuredToolInvocation({
      workspaceRoot,
      request: 'mystery mode',
      tools: [{ toolId: 'tool.description-empty', parameters: [{ name: 'mode', grammar: 'bash-like', completions: [undefined as unknown as string], description: 'mystery mode' }] }]
    });
    expect(descriptionEmpty.invocation.args).toEqual({});
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
        { toolId: 'tool.raw', parameters: [{ name: 'value', grammar: 'bash-like', completions: ['raw'] }] },
        { toolId: 'tool.described', description: 'pick described option', parameters: [{ name: 'value', grammar: 'bash-like', completions: ['described'] }] }
      ]
    });
    expect(selected.invocation.toolId).toBe('tool.described');

    const unmatchedDescription = await completeStructuredToolInvocation({
      workspaceRoot,
      request: 'no related terms',
      tools: [{ toolId: 'tool.no-match', parameters: [{ name: 'mode', grammar: 'bash-like', completions: ['safe'], description: 'safe mode' }] }]
    });
    expect(unmatchedDescription.invocation.args).toEqual({});
  });

  it('optimizes structured field values without mutating unknown or non-string fields', () => {
    const result = optimizeStructuredToolArgs(
      {
        sql: '  select  *   from issues  where state = open  ',
        query: '  is:issue   is:open   label : bug  ',
        pattern: '   foo\\s+bar   ',
        words: '  keep this short  ',
        count: 7,
        untouched: 7
      },
      {
        parameters: [
          { name: 'sql', grammar: 'sql', completions: ['select * from issues where state = open'] },
          { name: 'query', grammar: 'lucene', completions: ['is:issue is:open label:bug'] },
          { name: 'pattern', grammar: 'regex', completions: [] },
          { name: 'words', grammar: 'bash-like', completions: ['keep this short'] },
          { name: 'count', grammar: 'bash-like', completions: ['7'] }
        ]
      }
    );
    expect(result.applied).toBe(true);
    expect(result.value.sql).toBe('select * from issues where state = open');
    expect(result.value.query).toBe('is:issue is:open label:bug');
    expect(result.value.pattern).toBe('foo\\s+bar');
    expect(result.value.words).toBe('keep this short');
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
});
