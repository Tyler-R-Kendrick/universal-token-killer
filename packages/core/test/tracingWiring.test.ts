import { mkdir, mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { completeWithGrammar } from '@utk/constrained-decoder';
import {
  createRunContext,
  flushTrace,
  loadPack,
  loadPackManifest,
  loadUtkConfig,
  mediateToolExecution,
  readTemplateDescriptorCache,
  recordFailure,
  rewriteInputForLlm,
  routeFromCandidates,
  type RunContext
} from '../src/index.js';

const ENV_KEYS = ['UTK_DETOK_PYTHON'] as const;
const savedEnv: Record<string, string | undefined> = {};
afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

async function workspaceWithTracing(): Promise<string> {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'utk-wiring-'));
  await mkdir(path.join(workspace, '.utk'), { recursive: true });
  await writeFile(
    path.join(workspace, '.utk', 'config.toml'),
    [
      '[serialization]',
      'default = "toon"',
      '',
      '[serialization.providers.toon]',
      'enabled = true',
      '',
      '[serialization.providers.compressed-json]',
      'enabled = true',
      '',
      '[tracing]',
      'enabled = true',
      ''
    ].join('\n'),
    'utf8'
  );
  return workspace;
}

describe('mediateToolExecution tracer', () => {
  it('emits a root utk.mediate span plus a child tool span and flushes the trace', async () => {
    const workspace = await workspaceWithTracing();
    const config = await loadUtkConfig(workspace);
    const tracer = createRunContext(config, workspace, { runId: 'med-1', now: () => new Date('2026-05-19T22:00:00Z') });
    const result = await mediateToolExecution({
      workspaceRoot: workspace,
      toolId: 'git.status',
      input: { args: ['status'] },
      execute: async (input) => ({ files: ['a.ts'], echo: input }),
      tracer
    });
    expect(result.schemaId).toBeTruthy();
    const operations = tracer.spans.map((span) => span.operationName);
    expect(operations).toContain('utk.mediate');
    expect(operations).toContain('tool.git-status');
    const written = JSON.parse(await readFile(path.join(workspace, '.utk', 'events', 'med-1.jaeger.json'), 'utf8'));
    expect(written.data[0].traceID).toBe('med-1');
    expect(written.data[0].processes.utk.serviceName).toBe('utk');
  });

  it('rethrows the underlying executor error untouched when tracing is disabled', async () => {
    const workspace = await mkdtemp(path.join(os.tmpdir(), 'utk-untraced-'));
    await expect(
      mediateToolExecution({
        workspaceRoot: workspace,
        toolId: 'untraced',
        input: {},
        execute: async () => {
          throw new Error('still-throws');
        }
      })
    ).rejects.toThrow(/still-throws/);
  });

  it('records the error and rethrows when the underlying tool throws', async () => {
    const workspace = await workspaceWithTracing();
    const config = await loadUtkConfig(workspace);
    const tracer = createRunContext(config, workspace, { runId: 'med-3', now: () => new Date('2026-05-19T22:00:00Z') });
    await expect(
      mediateToolExecution({
        workspaceRoot: workspace,
        toolId: 'broken',
        input: {},
        execute: async () => {
          throw new Error('boom');
        },
        tracer
      })
    ).rejects.toThrow(/boom/);
    const errorLogs = tracer.spans.flatMap((span) =>
      span.logs.flatMap((log) => log.fields.filter((field) => field.key === 'exception.message').map((field) => field.value))
    );
    expect(errorLogs).toContain('boom');
  });
});

describe('routeFromCandidates tracer', () => {
  it('records router.fallback when no candidates match and the candidate list is empty', async () => {
    const workspace = await workspaceWithTracing();
    const config = await loadUtkConfig(workspace);
    const tracer = createRunContext(config, workspace, { runId: 'route-1', now: () => new Date('2026-05-19T22:00:00Z') });
    const decision = routeFromCandidates('tool.unknown', { a: 1 }, { kind: 'object' }, [], { tracer });
    expect(decision.reason).toBe('unknown');
    const codes = tracer.spans.flatMap((span) => span.logs.flatMap((log) => log.fields.filter((field) => field.key === 'utk.failure.code').map((field) => field.value)));
    expect(codes).toContain('router.fallback');
  });
});

describe('readTemplateDescriptorCache tracer', () => {
  it('records template.load when the cache file is malformed JSON', async () => {
    const workspace = await workspaceWithTracing();
    const config = await loadUtkConfig(workspace);
    const tracer = createRunContext(config, workspace, { runId: 'tpl-1', now: () => new Date('2026-05-19T22:00:00Z') });
    const cachePath = path.join(workspace, 'cache.json');
    await writeFile(cachePath, '{ not json', 'utf8');
    const descriptor = await readTemplateDescriptorCache(cachePath, { tracer });
    expect(descriptor).toBeUndefined();
    const codes = tracer.spans.flatMap((span) => span.logs.flatMap((log) => log.fields.filter((field) => field.key === 'utk.failure.code').map((field) => field.value)));
    expect(codes).toContain('template.load');
    await flushTrace(tracer);
  });
});

describe('rewriteInputForLlm tracer', () => {
  it('records detok.unavailable when llmlingua2 reports an error', async () => {
    const workspace = await workspaceWithTracing();
    const config = await loadUtkConfig(workspace);
    const tracer = createRunContext(config, workspace, { runId: 'detok-1', now: () => new Date('2026-05-19T22:00:00Z') });
    const big = 'x'.repeat(8001);
    savedEnv.UTK_DETOK_PYTHON = process.env.UTK_DETOK_PYTHON;
    process.env.UTK_DETOK_PYTHON = '/definitely/not/a/real/binary';
    const result = await rewriteInputForLlm(big, { tracer });
    expect(result.applied).toBe(false);
    const codes = tracer.spans.flatMap((span) => span.logs.flatMap((log) => log.fields.filter((field) => field.key === 'utk.failure.code').map((field) => field.value)));
    expect(codes).toContain('detok.unavailable');

    const tracerWithParent = createRunContext(config, workspace, { runId: 'detok-2', now: () => new Date('2026-05-19T22:00:00Z') });
    const { startSpan } = await import('../src/index.js');
    const parent = startSpan(tracerWithParent, { operationName: 'utk.mediate', runType: 'chain' });
    const withParent = await rewriteInputForLlm(big, { tracer: tracerWithParent, parentSpan: parent });
    expect(withParent.applied).toBe(false);
    expect(parent.logs.some((log) => log.fields.some((field) => field.key === 'utk.failure.code' && field.value === 'detok.unavailable'))).toBe(true);
  });
});

describe('B1: constrained-decoder tracer adapter', () => {
  it('proxies completeWithGrammar guidance.unavailable into the core RunContext', async () => {
    const workspace = await workspaceWithTracing();
    const config = await loadUtkConfig(workspace);
    const tracer: RunContext = createRunContext(config, workspace, { runId: 'b1', now: () => new Date('2026-05-19T22:00:00Z') });
    const adapter = { recordFailure: (opts: { name: string; error?: { message: string; name?: string }; extra?: Record<string, unknown> }) => { recordFailure(tracer, { name: opts.name, runType: 'llm', extra: opts.extra, ...(opts.error ? { error: opts.error } : {}) }); } };
    const result = await completeWithGrammar({ prompt: 'p', lark: 'start: "x"', slotName: 'slot', tracer: adapter });
    expect(result.available).toBe(false);
    const codes = tracer.spans.flatMap((span) => span.logs.flatMap((log) => log.fields.filter((field) => field.key === 'utk.failure.code').map((field) => field.value)));
    expect(codes).toContain('guidance.unavailable');
  });
});

describe('B2: ENOENT gating', () => {
  it('readTemplateDescriptorCache does not emit template.load when the file is simply absent', async () => {
    const workspace = await workspaceWithTracing();
    const config = await loadUtkConfig(workspace);
    const tracer = createRunContext(config, workspace, { runId: 'b2-tpl-enoent', now: () => new Date('2026-05-19T22:00:00Z') });
    const descriptor = await readTemplateDescriptorCache(path.join(workspace, 'nope.json'), { tracer });
    expect(descriptor).toBeUndefined();
    const codes = tracer.spans.flatMap((span) => span.logs.flatMap((log) => log.fields.filter((field) => field.key === 'utk.failure.code').map((field) => field.value)));
    expect(codes).not.toContain('template.load');
  });

  it('readTemplateDescriptorCache still emits template.load for malformed JSON', async () => {
    const workspace = await workspaceWithTracing();
    const config = await loadUtkConfig(workspace);
    const tracer = createRunContext(config, workspace, { runId: 'b2-tpl-bad', now: () => new Date('2026-05-19T22:00:00Z') });
    const cachePath = path.join(workspace, 'cache.json');
    await writeFile(cachePath, 'not valid json', 'utf8');
    await readTemplateDescriptorCache(cachePath, { tracer });
    const codes = tracer.spans.flatMap((span) => span.logs.flatMap((log) => log.fields.filter((field) => field.key === 'utk.failure.code').map((field) => field.value)));
    expect(codes).toContain('template.load');
  });

  it('loadPack does not emit pack.seed.parse when the default seed file is simply absent', async () => {
    const workspace = await workspaceWithTracing();
    const config = await loadUtkConfig(workspace);
    const tracer = createRunContext(config, workspace, { runId: 'b2-pack-noseed', now: () => new Date('2026-05-19T22:00:00Z') });
    const packDir = await mkdtemp(path.join(os.tmpdir(), 'utk-pack-noseed-'));
    await writeFile(
      path.join(packDir, 'utk.pack.toml'),
      [
        '[pack]',
        'name = "demo"',
        'version = "1.0.0"',
        '',
        '[[grammars]]',
        'tool = "t"',
        'field = "f"',
        ''
      ].join('\n'),
      'utf8'
    );
    await mkdir(path.join(packDir, 'grammars', 't'), { recursive: true });
    await writeFile(path.join(packDir, 'grammars', 't', 'f.lark'), 'start: "x"\n', 'utf8');
    await loadPack(packDir, { tracer });
    const codes = tracer.spans.flatMap((span) => span.logs.flatMap((log) => log.fields.filter((field) => field.key === 'utk.failure.code').map((field) => field.value)));
    expect(codes).not.toContain('pack.seed.parse');
  });
});

describe('B3: capture_inputs / capture_outputs gating', () => {
  it('omits utk.inputs and utk.outputs tags when both flags are disabled', async () => {
    const workspace = await mkdtemp(path.join(os.tmpdir(), 'utk-capture-off-'));
    await mkdir(path.join(workspace, '.utk'), { recursive: true });
    await writeFile(
      path.join(workspace, '.utk', 'config.toml'),
      [
        '[serialization]',
        'default = "toon"',
        '',
        '[serialization.providers.toon]',
        'enabled = true',
        '',
        '[serialization.providers.compressed-json]',
        'enabled = true',
        '',
        '[tracing]',
        'enabled = true',
        'capture_inputs = false',
        'capture_outputs = false',
        ''
      ].join('\n'),
      'utf8'
    );
    const config = await loadUtkConfig(workspace);
    const tracer = createRunContext(config, workspace, { runId: 'b3', now: () => new Date('2026-05-19T22:00:00Z') });
    await mediateToolExecution({
      workspaceRoot: workspace,
      toolId: 'redacted.tool',
      input: { secret: 'shhh' },
      execute: async () => ({ result: 'also-secret' }),
      tracer
    });
    const allTags = tracer.spans.flatMap((span) => span.tags);
    expect(allTags.some((tag) => tag.key === 'utk.inputs')).toBe(false);
    expect(allTags.some((tag) => tag.key === 'utk.outputs')).toBe(false);
    await rm(workspace, { recursive: true, force: true });
  });
});

describe('loadPack tracer', () => {
  it('records pack.manifest.parse when the manifest is malformed', async () => {
    const workspace = await workspaceWithTracing();
    const config = await loadUtkConfig(workspace);
    const tracer = createRunContext(config, workspace, { runId: 'pack-1', now: () => new Date('2026-05-19T22:00:00Z') });
    const packDir = await mkdtemp(path.join(os.tmpdir(), 'utk-pack-bad-'));
    await writeFile(path.join(packDir, 'utk.pack.toml'), 'not = "valid" toml = at-all', 'utf8');
    await expect(loadPackManifest(packDir, { tracer })).rejects.toThrow();
    const codes = tracer.spans.flatMap((span) => span.logs.flatMap((log) => log.fields.filter((field) => field.key === 'utk.failure.code').map((field) => field.value)));
    expect(codes).toContain('pack.manifest.parse');
  });

});
