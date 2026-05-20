import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadUtkConfig } from '../src/config/config.js';
import {
  TAGS,
  createRunContext,
  endSpan,
  flushTrace,
  newSpanId,
  nowMicros,
  recordFailure,
  startSpan,
  toEvalSet,
  type RunContext
} from '../src/tracing/index.js';

async function workspaceWithTracingEnabled(): Promise<{ ctx: RunContext; root: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'utk-tracing-'));
  await import('node:fs/promises').then((fs) => fs.mkdir(path.join(root, '.utk'), { recursive: true }));
  await import('node:fs/promises').then((fs) =>
    fs.writeFile(
      path.join(root, '.utk', 'config.toml'),
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
    )
  );
  const config = await loadUtkConfig(root);
  const ctx = createRunContext(config, root, {
    runId: 'fixed-run-id',
    now: () => new Date('2026-05-19T22:00:00.123Z')
  });
  return { ctx, root };
}

describe('tracing config', () => {
  it('exposes a default [tracing] block in the auto-created config', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-tracing-default-'));
    const config = await loadUtkConfig(root);
    expect(config.tracing.enabled).toBe(false);
    expect(config.tracing.capture_inputs).toBe(true);
    expect(config.tracing.emit_eval_set).toBe(true);
    expect(config.tracing.storage_root).toBe('.utk/events');
    expect(config.tracing.process_id).toBe('utk');
  });

  it('allows turning tracing on with custom storage', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-tracing-on-'));
    const fs = await import('node:fs/promises');
    await fs.mkdir(path.join(root, '.utk'), { recursive: true });
    await fs.writeFile(
      path.join(root, '.utk', 'config.toml'),
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
        'emit_eval_set = false',
        'storage_root = ".utk/traces"',
        'process_id = "custom"',
        ''
      ].join('\n'),
      'utf8'
    );
    const config = await loadUtkConfig(root);
    expect(config.tracing.enabled).toBe(true);
    expect(config.tracing.capture_inputs).toBe(false);
    expect(config.tracing.storage_root).toBe('.utk/traces');
    expect(config.tracing.process_id).toBe('custom');
  });
});

describe('runContext', () => {
  it('uses a default now() and randomly generated runId when not provided', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-runctx-default-'));
    const config = await loadUtkConfig(root);
    const ctx = createRunContext(config, root);
    expect(typeof ctx.runId).toBe('string');
    expect(ctx.runId.length).toBeGreaterThan(0);
    expect(ctx.runId).toBe(ctx.traceID);
    expect(ctx.spans).toEqual([]);
    expect(ctx.enabled).toBe(false);
    const before = ctx.now().getTime();
    const after = Date.now();
    expect(after - before).toBeLessThan(5000);
  });

  it('emits microsecond-resolution timestamps', async () => {
    const { ctx } = await workspaceWithTracingEnabled();
    expect(nowMicros(ctx)).toBe(new Date('2026-05-19T22:00:00.123Z').getTime() * 1000);
  });

  it('generates 16-hex-character span ids', () => {
    const id = newSpanId();
    expect(id).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('startSpan / endSpan / recordFailure', () => {
  it('builds a parent-child span tree with OTel GenAI tags', async () => {
    const { ctx } = await workspaceWithTracingEnabled();
    const root = startSpan(ctx, {
      operationName: 'utk.mediate',
      runType: 'chain',
      tags: [TAGS.system('utk'), TAGS.spanKind('internal'), TAGS.utkInputs({ query: 'hi' })]
    });
    const child = startSpan(ctx, {
      operationName: 'tool.git.status',
      runType: 'tool',
      parent: root,
      tags: [TAGS.toolCalls([{ name: 'git', id: child_id(), arguments: { subcommand: 'status' } }])]
    });
    endSpan(ctx, child, { tags: [TAGS.toolResult({ files: ['a.ts'] })] });
    endSpan(ctx, root, { tags: [TAGS.utkOutputs('done')] });

    expect(ctx.spans).toHaveLength(2);
    expect(ctx.spans[0]?.references).toEqual([]);
    expect(ctx.spans[1]?.references[0]?.refType).toBe('CHILD_OF');
    expect(ctx.spans[1]?.references[0]?.spanID).toBe(root.spanID);
    expect(child.duration).toBeGreaterThanOrEqual(0);
    expect(child.tags.some((tag) => tag.key === 'gen_ai.response.message.tool_result')).toBe(true);
  });

  it('records a failure log on an existing span and an orphan span when none provided', async () => {
    const { ctx } = await workspaceWithTracingEnabled();
    const span = startSpan(ctx, { operationName: 'tool.x', runType: 'tool' });
    recordFailure(ctx, { span, name: 'cache.write', error: new Error('disk full') });
    expect(span.logs).toHaveLength(1);
    expect(span.logs[0]?.fields.some((field) => field.key === 'exception.message' && field.value === 'disk full')).toBe(true);

    const orphan = recordFailure(ctx, { name: 'pack/lint/missing-files', runType: 'parser', extra: { fields: ['a'] } });
    expect(orphan).toBeDefined();
    expect(ctx.spans.length).toBe(2);
    expect(orphan?.logs[0]?.fields.some((field) => field.key === 'utk.failure.extra')).toBe(true);
  });

  it('records error with stack and operationName override', async () => {
    const { ctx } = await workspaceWithTracingEnabled();
    const err = new Error('boom');
    err.stack = 'stack-trace';
    const span = recordFailure(ctx, {
      name: 'router.fallback',
      operationName: 'router.evaluate',
      error: err
    });
    expect(span?.operationName).toBe('router.evaluate');
    expect(span?.logs[0]?.fields.some((field) => field.key === 'exception.stacktrace' && field.value === 'stack-trace')).toBe(true);
  });

  it('captures error info via endSpan and tolerates errors with no stack/name', async () => {
    const { ctx } = await workspaceWithTracingEnabled();
    const span = startSpan(ctx, { operationName: 'tool.y' });
    endSpan(ctx, span, { error: { message: 'partial' } });
    expect(span.logs).toHaveLength(1);
    expect(span.logs[0]?.fields.some((field) => field.key === 'exception.type' && field.value === 'Error')).toBe(true);
    const orphan = recordFailure(ctx, { name: 'planner.missing-required' });
    expect(orphan?.logs[0]?.fields.some((field) => field.key === 'exception.message' && field.value === '')).toBe(true);
  });

  it('is a no-op when ctx is undefined or disabled', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-tracing-disabled-'));
    const config = await loadUtkConfig(root);
    const disabled = createRunContext(config, root);
    expect(recordFailure(undefined, { name: 'x' })).toBeUndefined();
    expect(recordFailure(disabled, { name: 'x' })).toBeUndefined();
    expect(disabled.spans).toEqual([]);
  });
});

describe('genAiTags', () => {
  it('exposes every OTel GenAI helper used by core', () => {
    expect(TAGS.system('openai').key).toBe('gen_ai.system');
    expect(TAGS.model('gpt-4').key).toBe('gen_ai.request.model');
    expect(TAGS.spanKind('client').key).toBe('span.kind');
    expect(TAGS.toolCalls([{ name: 't', id: 'a', arguments: { x: 1 } }]).key).toBe('gen_ai.request.openai.tool_calls');
    expect(TAGS.toolResult({ ok: true }).key).toBe('gen_ai.response.message.tool_result');
    expect(TAGS.utkFailureCode('cache.write').value).toBe('cache.write');
    expect(TAGS.utkRunType('llm').value).toBe('llm');
    expect(TAGS.utkInputs({ a: 1 }).value).toContain('"a"');
    expect(TAGS.utkOutputs('plain').value).toBe('plain');
    expect(TAGS.utkOutputs({ result: 'ok' }).value).toContain('"result"');
    expect(TAGS.utkInputs('raw-string').value).toBe('raw-string');
  });
});

describe('toEvalSet', () => {
  it('derives a Google ADK eval set with one invocation from tagged tool spans', async () => {
    const { ctx } = await workspaceWithTracingEnabled();
    const root = startSpan(ctx, {
      operationName: 'utk.mediate',
      runType: 'chain',
      tags: [TAGS.utkInputs('show me changes'), TAGS.utkOutputs('done')]
    });
    const tool = startSpan(ctx, {
      operationName: 'tool.git.status',
      runType: 'tool',
      parent: root,
      tags: [TAGS.utkInputs(JSON.stringify({ subcommand: 'status' })), TAGS.utkOutputs(JSON.stringify({ files: ['a.ts'] }))]
    });
    endSpan(ctx, tool);
    endSpan(ctx, root);

    const evalSet = toEvalSet(ctx.spans, ctx.runId, { name: 'demo' });
    expect(evalSet.eval_set_id).toBe('fixed-run-id');
    expect(evalSet.name).toBe('demo');
    expect(evalSet.eval_cases[0]?.conversation[0]?.user_content.parts[0]?.text).toBe('show me changes');
    expect(evalSet.eval_cases[0]?.conversation[0]?.intermediate_data.tool_uses[0]?.name).toBe('tool.git.status');
    expect(evalSet.eval_cases[0]?.conversation[0]?.intermediate_data.tool_uses[0]?.args).toEqual({ subcommand: 'status' });
    expect(evalSet.eval_cases[0]?.conversation[0]?.intermediate_data.tool_responses[0]?.response).toContain('a.ts');
  });

  it('defaults the eval-set name when none is provided and handles empty inputs/outputs', () => {
    const evalSet = toEvalSet([], 'r1');
    expect(evalSet.name).toBe('utk-run-r1');
    expect(evalSet.eval_cases[0]?.conversation[0]?.user_content.parts[0]?.text).toBe('');
    expect(evalSet.eval_cases[0]?.conversation[0]?.intermediate_data.tool_uses).toEqual([]);
  });

  it('falls back to defaults when tool spans lack inputs/outputs tags', async () => {
    const { ctx } = await workspaceWithTracingEnabled();
    const root = startSpan(ctx, { operationName: 'utk.mediate', runType: 'chain' });
    const tool = startSpan(ctx, { operationName: 'tool.bare', runType: 'tool', parent: root });
    endSpan(ctx, tool);
    endSpan(ctx, root);
    const evalSet = toEvalSet(ctx.spans, ctx.runId);
    expect(evalSet.eval_cases[0]?.conversation[0]?.intermediate_data.tool_uses[0]?.args).toEqual({});
    expect(evalSet.eval_cases[0]?.conversation[0]?.intermediate_data.tool_responses[0]?.response).toBe('');
  });

  it('falls back to non-string tag values and unparseable JSON gracefully', async () => {
    const { ctx } = await workspaceWithTracingEnabled();
    const root = startSpan(ctx, { operationName: 'utk.mediate', runType: 'chain' });
    root.tags.push({ key: 'utk.inputs', value: 42 });
    const tool = startSpan(ctx, {
      operationName: 'tool.x',
      runType: 'tool',
      parent: root,
      tags: [TAGS.utkInputs('not-json'), TAGS.utkOutputs('plain text')]
    });
    endSpan(ctx, tool);
    endSpan(ctx, root);
    const evalSet = toEvalSet(ctx.spans, ctx.runId);
    expect(evalSet.eval_cases[0]?.conversation[0]?.user_content.parts[0]?.text).toBe('');
    expect(evalSet.eval_cases[0]?.conversation[0]?.intermediate_data.tool_uses[0]?.args).toBe('not-json');
  });
});

describe('flushTrace', () => {
  it('writes a Jaeger JSON document and an eval-set sidecar', async () => {
    const { ctx, root } = await workspaceWithTracingEnabled();
    const span = startSpan(ctx, {
      operationName: 'utk.mediate',
      runType: 'chain',
      tags: [TAGS.system('utk'), TAGS.utkInputs('hello'), TAGS.utkOutputs('world')]
    });
    endSpan(ctx, span);
    const result = await flushTrace(ctx);
    expect(result?.jaegerPath.endsWith('fixed-run-id.jaeger.json')).toBe(true);
    expect(result?.evalSetPath?.endsWith('fixed-run-id.eval_set.json')).toBe(true);
    const jaegerText = await readFile(result!.jaegerPath, 'utf8');
    expect(jaegerText).toContain('"traceID": "fixed-run-id"');
    expect(jaegerText).toContain('"serviceName": "utk"');
    const evalText = await readFile(result!.evalSetPath!, 'utf8');
    expect(evalText).toContain('"eval_set_id": "fixed-run-id"');
  });

  it('skips eval-set sidecar when emit_eval_set is false', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-flush-noeval-'));
    const fs = await import('node:fs/promises');
    await fs.mkdir(path.join(root, '.utk'), { recursive: true });
    await fs.writeFile(
      path.join(root, '.utk', 'config.toml'),
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
        'emit_eval_set = false',
        ''
      ].join('\n'),
      'utf8'
    );
    const config = await loadUtkConfig(root);
    const ctx = createRunContext(config, root, {
      runId: 'no-eval',
      now: () => new Date('2026-05-19T22:00:00Z')
    });
    const result = await flushTrace(ctx);
    expect(result?.evalSetPath).toBeUndefined();
    expect(result?.evalSet).toBeUndefined();
  });

  it('returns undefined when tracing is disabled', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-flush-disabled-'));
    const config = await loadUtkConfig(root);
    const ctx = createRunContext(config, root);
    expect(await flushTrace(ctx)).toBeUndefined();
  });

  it('refuses to write a Jaeger file whose runId would escape the events directory', async () => {
    const { ctx } = await workspaceWithTracingEnabled();
    const malicious = createRunContext(
      { tracing: { enabled: true, capture_inputs: true, capture_outputs: true, emit_eval_set: true, storage_root: '.utk/events', process_id: 'utk' } } as unknown as Parameters<typeof createRunContext>[0],
      ctx.workspaceRoot,
      { runId: '../escapee', now: () => new Date('2026-05-19T22:00:00Z') }
    );
    await expect(flushTrace(malicious)).rejects.toThrow(/Path traversal/);
  });
});

function child_id(): string {
  return newSpanId();
}
