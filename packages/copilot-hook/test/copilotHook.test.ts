import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { canonicalJson, contentHash, normalizeToolId } from '@utk/core';
import { processCopilotPreToolUsePayload, processCopilotToolHookPayload } from '../src/copilotHook.js';

describe('GitHub Copilot tool hook', () => {
  it('mediates observable non-shell tool results instead of passing through', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-copilot-hook-'));
    const payload = JSON.stringify({
      tool_name: 'read_file',
      tool_input: { path: 'src/index.ts' },
      tool_output: { contents: 'export const value = 1;' }
    });

    const output = await processCopilotToolHookPayload(payload, { workspaceRoot });

    expect(output).toBeTruthy();
    const parsed = JSON.parse(output ?? '{}') as { hookSpecificOutput?: { updatedOutput?: string } };
    expect(parsed.hookSpecificOutput?.updatedOutput).toContain('Tool result stored at:');
    expect(parsed.hookSpecificOutput?.updatedOutput).toContain('Serializer: toon');
    expect(await readFile(path.join(workspaceRoot, '.utk', 'routes', 'index.json'), 'utf8')).toContain('read_file');
  });

  it('passes malformed and unobservable payloads through silently', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-copilot-pass-'));

    await expect(processCopilotToolHookPayload('{', { workspaceRoot })).resolves.toBeUndefined();
    await expect(processCopilotToolHookPayload('null', { workspaceRoot })).resolves.toBeUndefined();
    await expect(processCopilotToolHookPayload(JSON.stringify({ tool_input: { path: 'x' }, tool_output: 'x' }), { workspaceRoot })).resolves.toBeUndefined();
    await expect(processCopilotToolHookPayload(JSON.stringify({ tool_name: 'read_file', tool_input: { path: 'x' } }), { workspaceRoot })).resolves.toBeUndefined();
  });

  it('observes alternate Copilot hook field names', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-copilot-alternate-'));

    await expect(processCopilotToolHookPayload(JSON.stringify({ toolName: 'tool.alt', toolInput: { id: 1 }, toolOutput: { ok: true } }), { workspaceRoot })).resolves.toContain('updatedOutput');
    await expect(processCopilotToolHookPayload(JSON.stringify({ toolName: 'tool.result', result: { ok: true } }), { workspaceRoot })).resolves.toContain('updatedOutput');
    await expect(processCopilotToolHookPayload(JSON.stringify({ toolName: 'tool.args', toolArgs: { query: 'is:open' }, toolOutput: { ok: true } }), { workspaceRoot })).resolves.toContain('updatedOutput');
  });
});

describe('GitHub Copilot LLMLingua preToolUse hook', () => {
  it('rewrites safe long LLM-bound tool args through modifiedArgs', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-copilot-detok-'));
    const previousFake = process.env.UTK_DETOK_FAKE;
    process.env.UTK_DETOK_FAKE = '1';
    const longPrompt = Array.from({ length: 500 }, (_, index) => `important planning sentence ${index}`).join(' ');

    try {
      const output = await processCopilotPreToolUsePayload(
        JSON.stringify({
          toolName: 'agent.plan',
          toolArgs: {
            prompt: longPrompt,
            path: 'src/index.ts'
          }
        }),
        { workspaceRoot }
      );

      const parsed = JSON.parse(output ?? '{}') as { modifiedArgs?: { prompt?: string; path?: string } };
      expect(parsed.modifiedArgs?.prompt).toBeTruthy();
      expect(parsed.modifiedArgs?.prompt).not.toBe(longPrompt);
      expect(parsed.modifiedArgs?.path).toBe('src/index.ts');
    } finally {
      if (previousFake === undefined) delete process.env.UTK_DETOK_FAKE;
      else process.env.UTK_DETOK_FAKE = previousFake;
    }
  });

  it('supports snake_case payloads and preserves protected fields', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-copilot-detok-snake-'));
    const previousFake = process.env.UTK_DETOK_FAKE;
    process.env.UTK_DETOK_FAKE = '1';
    const longMessage = Array.from({ length: 500 }, (_, index) => `status report sentence ${index}`).join(' ');

    try {
      const output = await processCopilotPreToolUsePayload(
        JSON.stringify({
          tool_name: 'agent.report',
          tool_input: {
            message: longMessage,
            command: 'git status --short',
            old_string: 'exact text must remain'
          }
        }),
        { workspaceRoot }
      );

      const parsed = JSON.parse(output ?? '{}') as { modifiedArgs?: { message?: string; command?: string; old_string?: string } };
      expect(parsed.modifiedArgs?.message).not.toBe(longMessage);
      expect(parsed.modifiedArgs?.command).toBe('git status --short');
      expect(parsed.modifiedArgs?.old_string).toBe('exact text must remain');
    } finally {
      if (previousFake === undefined) delete process.env.UTK_DETOK_FAKE;
      else process.env.UTK_DETOK_FAKE = previousFake;
    }
  });

  it('passes through malformed, short, denied-tool, and unavailable-compressor events', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-copilot-detok-pass-'));
    const previousFake = process.env.UTK_DETOK_FAKE;
    const previousPython = process.env.UTK_DETOK_PYTHON;

    await expect(processCopilotPreToolUsePayload('{', { workspaceRoot })).resolves.toBeUndefined();
    await expect(processCopilotPreToolUsePayload(JSON.stringify({ toolArgs: { prompt: 'short prompt' } }), { workspaceRoot })).resolves.toBeUndefined();
    await expect(processCopilotPreToolUsePayload(JSON.stringify({ toolName: 'agent.plan' }), { workspaceRoot })).resolves.toBeUndefined();
    await expect(processCopilotPreToolUsePayload(JSON.stringify({ toolName: 'agent.plan', toolArgs: { prompt: 'short prompt' } }), { workspaceRoot })).resolves.toBeUndefined();

    process.env.UTK_DETOK_FAKE = '1';
    await expect(
      processCopilotPreToolUsePayload(
        JSON.stringify({ toolName: 'bash', toolArgs: { prompt: Array.from({ length: 1000 }, () => 'no rewrite').join(' ') } }),
        { workspaceRoot }
      )
    ).resolves.toBeUndefined();

    delete process.env.UTK_DETOK_FAKE;
    process.env.UTK_DETOK_PYTHON = 'definitely-missing-python';
    await expect(
      processCopilotPreToolUsePayload(
        JSON.stringify({ toolName: 'agent.plan', toolArgs: { prompt: Array.from({ length: 1000 }, () => 'compress me').join(' ') } }),
        { workspaceRoot }
      )
    ).resolves.toBe('{}');

    if (previousFake === undefined) delete process.env.UTK_DETOK_FAKE;
    else process.env.UTK_DETOK_FAKE = previousFake;
    if (previousPython === undefined) delete process.env.UTK_DETOK_PYTHON;
    else process.env.UTK_DETOK_PYTHON = previousPython;
  });

  it('handles nested values, arrays, overrides, disabled config, and config errors safely', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-copilot-detok-policy-'));
    const previousFake = process.env.UTK_DETOK_FAKE;
    process.env.UTK_DETOK_FAKE = '1';
    const longText = Array.from({ length: 500 }, (_, index) => `nested prompt sentence ${index}`).join(' ');

    try {
      await import('node:fs/promises').then((fs) => fs.mkdir(path.join(workspaceRoot, '.utk'), { recursive: true }));
      await import('node:fs/promises').then((fs) =>
        fs.writeFile(
          path.join(workspaceRoot, '.utk', 'config.toml'),
          [
            '[serialization]',
            'default = "toon"',
            '',
            '[detok]',
            'enabled = true',
            '',
            '[detok.copilot_pre_tool_use]',
            'enabled = true',
            'min_chars = 10',
            'deny_tools = ["agent.blocked*"]',
            'rewrite_fields = ["message"]',
            'protected_fields = ["id"]',
            '',
            '[[detok.copilot_pre_tool_use.overrides]]',
            'tool = "agent.blocked.override"',
            'enabled = true',
            'rewrite_fields = ["custom"]',
            'protected_fields = ["path"]',
            '',
            '[[detok.copilot_pre_tool_use.overrides]]',
            'tool = "agent.disabled"',
            'enabled = false',
            ''
          ].join('\n'),
          'utf8'
        )
      );

      const nested = await processCopilotPreToolUsePayload(
        JSON.stringify({
          toolName: 'agent.nested',
          toolArgs: {
            context: {
              message: [longText, 7, { message: longText }],
              ignored: longText,
              id: longText
            }
          }
        }),
        { workspaceRoot }
      );
      const parsedNested = JSON.parse(nested ?? '{}') as { modifiedArgs?: { context?: { message?: [string, number, { message: string }]; ignored?: string; id?: string } } };
      expect(parsedNested.modifiedArgs?.context?.message?.[0]).not.toBe(longText);
      expect(parsedNested.modifiedArgs?.context?.message?.[1]).toBe(7);
      expect(parsedNested.modifiedArgs?.context?.message?.[2].message).not.toBe(longText);
      expect(parsedNested.modifiedArgs?.context?.ignored).toBe(longText);
      expect(parsedNested.modifiedArgs?.context?.id).toBe(longText);

      await expect(
        processCopilotPreToolUsePayload(JSON.stringify({ toolName: 'agent.blocked.tool', toolArgs: { message: longText } }), { workspaceRoot })
      ).resolves.toBeUndefined();

      const override = await processCopilotPreToolUsePayload(
        JSON.stringify({ toolName: 'agent.blocked.override', toolArgs: { custom: longText, path: longText } }),
        { workspaceRoot }
      );
      const parsedOverride = JSON.parse(override ?? '{}') as { modifiedArgs?: { custom?: string; path?: string } };
      expect(parsedOverride.modifiedArgs?.custom).not.toBe(longText);
      expect(parsedOverride.modifiedArgs?.path).toBe(longText);

      await expect(
        processCopilotPreToolUsePayload(JSON.stringify({ toolName: 'agent.disabled', toolArgs: { message: longText } }), { workspaceRoot })
      ).resolves.toBeUndefined();

      await import('node:fs/promises').then((fs) =>
        fs.writeFile(path.join(workspaceRoot, '.utk', 'config.toml'), '[serialization]\n[detok]\nenabled = false\n', 'utf8')
      );
      await expect(
        processCopilotPreToolUsePayload(JSON.stringify({ toolName: 'agent.nested', toolInput: { message: longText } }), { workspaceRoot })
      ).resolves.toBeUndefined();

      await import('node:fs/promises').then((fs) =>
        fs.writeFile(path.join(workspaceRoot, '.utk', 'config.toml'), '[serialization]\n[detok.copilot_pre_tool_use]\nenabled = false\n', 'utf8')
      );
      await expect(
        processCopilotPreToolUsePayload(JSON.stringify({ toolName: 'agent.nested', toolInput: { message: longText } }), { workspaceRoot })
      ).resolves.toBeUndefined();

      await import('node:fs/promises').then((fs) => fs.writeFile(path.join(workspaceRoot, '.utk', 'config.toml'), 'detok = "bad"\n[serialization]\n', 'utf8'));
      await expect(
        processCopilotPreToolUsePayload(JSON.stringify({ toolName: 'agent.nested', toolArgs: { message: longText } }), { workspaceRoot })
      ).resolves.toBe('{}');
    } finally {
      if (previousFake === undefined) delete process.env.UTK_DETOK_FAKE;
      else process.env.UTK_DETOK_FAKE = previousFake;
    }
  });

  it('applies structured input normalization and cache bypass for registered tools', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-copilot-structured-'));
    await import('node:fs/promises').then((fs) => fs.mkdir(path.join(workspaceRoot, '.utk'), { recursive: true }));
    await import('node:fs/promises').then((fs) =>
      fs.writeFile(
        path.join(workspaceRoot, '.utk', 'config.toml'),
        [
          '[serialization]',
          'default = "toon"',
          '',
          '[detok]',
          'enabled = false',
          '',
          '[[tools.registry]]',
          'tool = "github.search.issues"',
          'output_cache = true',
          'bypass_on_cache = true',
          '',
          '[[tools.registry.structured_fields]]',
          'name = "query"',
          'grammar = "lucene"',
          'completions = ["is:issue is:open label:bug"]',
          'required = true',
          ''
        ].join('\n'),
        'utf8'
      )
    );

    const normalized = await processCopilotPreToolUsePayload(
      JSON.stringify({
        toolName: 'github.search.issues',
        toolArgs: { query: '  is:issue  is:open  label : bug  ' }
      }),
      { workspaceRoot }
    );
    const normalizedParsed = JSON.parse(normalized ?? '{}') as { modifiedArgs?: { query?: string } };
    expect(normalizedParsed.modifiedArgs?.query).toBe('is:issue is:open label:bug');

    await processCopilotToolHookPayload(
      JSON.stringify({
        toolName: 'github.search.issues',
        toolArgs: { query: 'is:issue is:open label:bug' },
        toolOutput: { items: [{ id: 1 }] }
      }),
      { workspaceRoot }
    );

    const bypassed = await processCopilotPreToolUsePayload(
      JSON.stringify({
        tool_name: 'github.search.issues',
        tool_input: { query: 'is:issue is:open label:bug' }
      }),
      { workspaceRoot }
    );
    const bypassedParsed = JSON.parse(bypassed ?? '{}') as { permissionDecision?: string; permissionDecisionReason?: string };
    expect(bypassedParsed.permissionDecision).toBe('deny');
    expect(bypassedParsed.permissionDecisionReason).toContain('cache hit');

    const malformedInput = { query: 'is:issue is:open label:enhancement' };
    const malformedHash = contentHash(canonicalJson(malformedInput));
    const malformedPath = path.join(
      workspaceRoot,
      '.utk',
      'cache',
      'tool-output',
      normalizeToolId('github.search.issues'),
      `${malformedHash}.json`
    );
    await import('node:fs/promises').then((fs) => fs.mkdir(path.dirname(malformedPath), { recursive: true }));
    await import('node:fs/promises').then((fs) => fs.writeFile(malformedPath, '{}', 'utf8'));
    await expect(
      processCopilotPreToolUsePayload(
        JSON.stringify({
          tool_name: 'github.search.issues',
          tool_input: malformedInput
        }),
        { workspaceRoot }
      )
    ).resolves.toBeUndefined();
  });

  it('writes cache even when post-tool input is not a plain object', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-copilot-cache-nonobj-'));
    await import('node:fs/promises').then((fs) => fs.mkdir(path.join(workspaceRoot, '.utk'), { recursive: true }));
    await import('node:fs/promises').then((fs) =>
      fs.writeFile(
        path.join(workspaceRoot, '.utk', 'config.toml'),
        [
          '[serialization]',
          'default = "toon"',
          '',
          '[detok]',
          'enabled = false',
          '',
          '[[tools.registry]]',
          'tool = "tool.cache.nonobj"',
          'output_cache = true',
          ''
        ].join('\n'),
        'utf8'
      )
    );

    await expect(
      processCopilotToolHookPayload(
        JSON.stringify({
          toolName: 'tool.cache.nonobj',
          toolArgs: ['raw', 'positional'],
          toolOutput: { ok: true }
        }),
        { workspaceRoot }
      )
    ).resolves.toContain('updatedOutput');
  });

  it('normalizes args in the post-tool path so pre-tool bypass hits regardless of caller arg shape', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-copilot-cache-post-normalize-'));
    await import('node:fs/promises').then((fs) => fs.mkdir(path.join(workspaceRoot, '.utk'), { recursive: true }));
    await import('node:fs/promises').then((fs) =>
      fs.writeFile(
        path.join(workspaceRoot, '.utk', 'config.toml'),
        [
          '[serialization]',
          'default = "toon"',
          '',
          '[detok]',
          'enabled = false',
          '',
          '[[tools.registry]]',
          'tool = "github.search.issues"',
          'output_cache = true',
          'bypass_on_cache = true',
          '',
          '[[tools.registry.structured_fields]]',
          'name = "query"',
          'grammar = "lucene"',
          'completions = ["is:issue is:open label:bug"]',
          'required = true',
          ''
        ].join('\n'),
        'utf8'
      )
    );

    await processCopilotToolHookPayload(
      JSON.stringify({
        toolName: 'github.search.issues',
        toolArgs: { query: '  is:issue   is:open   label : bug  ' },
        toolOutput: { items: [{ id: 1 }] }
      }),
      { workspaceRoot }
    );

    const bypassed = await processCopilotPreToolUsePayload(
      JSON.stringify({
        tool_name: 'github.search.issues',
        tool_input: { query: 'is:issue is:open label:bug' }
      }),
      { workspaceRoot }
    );
    const bypassedParsed = JSON.parse(bypassed ?? '{}') as { permissionDecision?: string };
    expect(bypassedParsed.permissionDecision).toBe('deny');
  });

  it('hashes cache keys canonically so arg key order does not cause cache misses', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-copilot-cache-order-'));
    await import('node:fs/promises').then((fs) => fs.mkdir(path.join(workspaceRoot, '.utk'), { recursive: true }));
    await import('node:fs/promises').then((fs) =>
      fs.writeFile(
        path.join(workspaceRoot, '.utk', 'config.toml'),
        [
          '[serialization]',
          'default = "toon"',
          '',
          '[detok]',
          'enabled = false',
          '',
          '[[tools.registry]]',
          'tool = "tool.cache.order"',
          'output_cache = true',
          'bypass_on_cache = true',
          ''
        ].join('\n'),
        'utf8'
      )
    );

    await processCopilotToolHookPayload(
      JSON.stringify({
        toolName: 'tool.cache.order',
        toolArgs: { alpha: 1, beta: 2 },
        toolOutput: { ok: true }
      }),
      { workspaceRoot }
    );

    const swapped = await processCopilotPreToolUsePayload(
      JSON.stringify({
        tool_name: 'tool.cache.order',
        tool_input: { beta: 2, alpha: 1 }
      }),
      { workspaceRoot }
    );
    const swappedParsed = JSON.parse(swapped ?? '{}') as { permissionDecision?: string };
    expect(swappedParsed.permissionDecision).toBe('deny');
  });
});
