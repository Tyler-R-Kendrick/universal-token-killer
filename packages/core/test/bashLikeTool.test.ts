import { access, mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildBashLikeInvocationGrammar, completeBashLikeToolInvocation } from '../src/index.js';

describe('bash-like llguidance tool invocation', () => {
  it('stores a serialized llguidance template and completes known parameters', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-bash-tool-'));

    const result = await completeBashLikeToolInvocation({
      workspaceRoot,
      request: 'run git status --short',
      tools: [
        {
          toolId: 'bash.git.status',
          command: 'git',
          description: 'Inspect repository status',
          parameters: [
            { name: 'subcommand', kind: 'positional', completions: ['status'], required: true },
            { name: 'short', kind: 'flag', flag: '--short', completions: ['--short'], description: 'Use concise status output' }
          ]
        }
      ]
    });

    expect(result.invocation).toEqual({
      toolId: 'bash.git.status',
      command: 'git status --short',
      argv: ['git', 'status', '--short'],
      parameters: { subcommand: 'status', short: '--short' }
    });
    expect(result.serializerId).toBe('toon');
    expect(result.guidance.used).toBe(true);
    expect(result.guidance.available).toBe(false);
    expect(JSON.stringify(result.guidance.serializedGrammar)).toContain('status');
    expect(result.templatePath.endsWith('cli-template.compact.toon')).toBe(true);
    await expect(access(result.templatePath)).resolves.toBeUndefined();
    const templateText = await readFile(result.templatePath, 'utf8');
    expect(templateText).toContain('template');
    expect(templateText).toContain('bash.git.status');
  });

  it('reports missing required completions instead of inventing arguments', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-bash-tool-missing-'));

    const result = await completeBashLikeToolInvocation({
      workspaceRoot,
      request: 'checkout the feature branch',
      tools: [
        {
          toolId: 'bash.git.checkout',
          command: 'git',
          description: 'Checkout a git branch',
          parameters: [
            { name: 'subcommand', kind: 'positional', completions: ['checkout'], required: true },
            { name: 'branch', kind: 'positional', completions: [], required: true }
          ]
        }
      ]
    });

    expect(result.invocation.command).toBe('git checkout');
    expect(result.missingRequired).toEqual(['branch']);
    expect(result.confidence).toBeLessThan(1);
  });

  it('rejects empty tool registries', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-bash-tool-empty-'));
    await expect(completeBashLikeToolInvocation({ workspaceRoot, request: 'status', tools: [] })).rejects.toThrow(
      'At least one tool definition is required'
    );
  });

  it('supports option parameters and records missing malformed option templates', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-bash-tool-option-'));

    const optionResult = await completeBashLikeToolInvocation({
      workspaceRoot,
      request: 'run tests with gpt-4o',
      tools: [
        {
          toolId: 'bash.eval',
          command: 'utk-eval',
          parameters: [{ name: 'model', kind: 'option', flag: '--model', completions: ['gpt-4o'], required: true }]
        }
      ]
    });

    expect(optionResult.invocation.argv).toEqual(['utk-eval', '--model', 'gpt-4o']);

    const malformedResult = await completeBashLikeToolInvocation({
      workspaceRoot,
      request: 'run malformed option optional',
      tools: [
        {
          toolId: 'bash.malformed',
          command: 'badtool',
          parameters: [
            { name: 'value', kind: 'option', completions: ['known'], required: true },
            { name: 'optional', kind: 'option', completions: ['optional'] }
          ]
        }
      ]
    });

    expect(malformedResult.invocation.argv).toEqual(['badtool']);
    expect(malformedResult.missingRequired).toEqual(['value']);
  });

  it('builds a valid grammar for commands without parameter completions', () => {
    const grammar = buildBashLikeInvocationGrammar([{ toolId: 'bash.noop', command: 'true', parameters: [] }]);
    expect(JSON.stringify(grammar.serialize())).toContain('bash.noop');
  });

  it('uses tool descriptions when selecting between bash-like templates', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-bash-tool-description-'));
    const result = await completeBashLikeToolInvocation({
      workspaceRoot,
      request: 'show repository health',
      tools: [
        { toolId: 'bash.echo', command: 'echo', parameters: [] },
        {
          toolId: 'bash.health',
          command: 'git',
          description: 'repository health',
          parameters: [{ name: 'subcommand', kind: 'positional', completions: ['status'], required: true }]
        }
      ]
    });

    expect(result.invocation.toolId).toBe('bash.health');
  });

  it('covers explicit flag, description, and empty completion matching', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-bash-tool-policy-'));

    const flagResult = await completeBashLikeToolInvocation({
      workspaceRoot,
      request: 'list all files with -a',
      tools: [
        {
          toolId: 'bash.ls',
          command: 'ls',
          parameters: [{ name: 'all', kind: 'flag', flag: '-a', completions: [] }]
        }
      ]
    });
    expect(flagResult.invocation.argv).toEqual(['ls', '-a']);

    const descriptionResult = await completeBashLikeToolInvocation({
      workspaceRoot,
      request: 'run the safe mode',
      tools: [
        {
          toolId: 'bash.safe',
          command: 'safe',
          parameters: [{ name: 'mode', kind: 'flag', flag: '--safe', completions: [], description: 'safe mode' }]
        }
      ]
    });
    expect(descriptionResult.invocation.argv).toEqual(['safe', '--safe']);

    const emptyCompletionResult = await completeBashLikeToolInvocation({
      workspaceRoot,
      request: 'literal command',
      tools: [
        {
          toolId: 'bash.literal',
          command: 'literal',
          parameters: [{ name: 'punctuation', kind: 'positional', completions: ['!!!'] }]
        }
      ]
    });
    expect(emptyCompletionResult.invocation.argv).toEqual(['literal']);
  });

  it('applies learned field grammars to completions on subsequent invocations', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-bash-tool-learn-'));
    const tool = {
      toolId: 'bash.fmt',
      command: 'fmt',
      parameters: [{ name: 'expr', kind: 'positional' as const, completions: ['a : b'], required: true }]
    };

    const first = await completeBashLikeToolInvocation({
      workspaceRoot,
      request: 'use expr a : b',
      tools: [tool]
    });
    expect(first.invocation.parameters.expr).toBe('a : b');

    const { recordFieldObservation } = await import('../src/index.js');
    for (let i = 0; i < 5; i += 1) {
      await recordFieldObservation(workspaceRoot, tool.toolId, 'expr', 'a:b');
    }

    const after = await completeBashLikeToolInvocation({
      workspaceRoot,
      request: 'use expr a : b',
      tools: [tool]
    });
    expect(after.invocation.parameters.expr).toBe('a:b');
  });
});
