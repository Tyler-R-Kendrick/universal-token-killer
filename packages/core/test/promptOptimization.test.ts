import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  classifyPromptSurface,
  measurePromptOptimization,
  optimizePromptSurface,
  protectPromptSpans
} from '../src/index.js';

describe('prompt surface optimization', () => {
  it('optimizes system prompts while preserving security warnings, tool names, paths, policies, and priority order', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-prompt-opt-system-'));
    const prompt = [
      'System priority: system > developer > user.',
      'Security warning: never expose secrets.',
      'Use tool reason-with-lexicon exactly when schema routing repeats.',
      'Recover full output from C:/repo/.utk/tools/search/observations/1/output.raw.txt.',
      'The following guidance is repeated. The following guidance is repeated. The following guidance is repeated.',
      'Universal Token Killer should preserve raw artifacts, schema routing, TOON, compressed JSON, and local recovery artifacts.'
    ].join('\n');

    const result = await optimizePromptSurface({
      workspaceRoot,
      surface: 'system-prompt',
      text: prompt,
      persistOriginal: true
    });

    expect(result.optimizedText.length).toBeLessThan(prompt.length);
    expect(result.optimizedText).toContain('Security warning: never expose secrets.');
    expect(result.optimizedText).toContain('reason-with-lexicon');
    expect(result.optimizedText).toContain('C:/repo/.utk/tools/search/observations/1/output.raw.txt');
    expect(result.optimizedText).toContain('system > developer > user');
    expect(result.optimizedText).toContain('[utk-prompt-ref:');
    expect(result.protectedSpans.map((span) => span.kind)).toEqual(expect.arrayContaining(['security', 'tool', 'path', 'priority']));
    expect(result.metrics.rawTokens).toBeGreaterThan(result.metrics.optimizedTokens);
    expect(result.artifactId).toMatch(/^utkp_/);
    expect(await readFile(result.artifactPath!, 'utf8')).toBe(prompt);
  });

  it('optimizes agent skills, GHCP agents, and tool/recovery definitions without dropping required terms', async () => {
    const skill = [
      '---',
      'name: schema-route-triage',
      'description: Use when repeated UTK schema routing triage is needed.',
      '---',
      '',
      'Purpose: Reduce repeated schema routing instructions across future turns.',
      'Use when route confidence and serializer artifacts repeat.',
      'default_prompt: "Use $schema-route-triage to avoid repeating session-specific instructions."',
      'References:',
      '- references/route-checklist.md',
      'Procedure: inspect route confidence, inspect route confidence, inspect route confidence.'
    ].join('\n');
    const skillResult = await optimizePromptSurface({ surface: 'agent-skill', text: skill });
    expect(skillResult.optimizedText).toContain('name: schema-route-triage');
    expect(skillResult.optimizedText).toContain('Use when repeated UTK schema routing triage is needed.');
    expect(skillResult.optimizedText).toContain('default_prompt');
    expect(skillResult.optimizedText).toContain('references/route-checklist.md');
    expect(skillResult.metrics.optimizedTokens).toBeLessThan(skillResult.metrics.rawTokens);

    const agent = [
      '---',
      'name: schema-router-analyst',
      'description: Use when schema routing needs analysis.',
      'tools: ["reason-with-lexicon"]',
      '---',
      'Use grammar hash `abc123ef`; grammar stored at `.utk/session-agents/grammars/schema.abc123ef.guidance.json`.',
      'Tool registration stored at `.utk/session-agents/tools/schema.reason-with-lexicon.json`.',
      'Output contract: sketch-of-thought.',
      'Repeated extra guidance. Repeated extra guidance. Repeated extra guidance.'
    ].join('\n');
    const agentResult = await optimizePromptSurface({ surface: 'ghcp-agent', text: agent });
    expect(agentResult.optimizedText).toContain('tools: ["reason-with-lexicon"]');
    expect(agentResult.optimizedText).toContain('abc123ef');
    expect(agentResult.optimizedText).toContain('sketch-of-thought');
    expect(agentResult.optimizedText).toContain('.guidance.json');

    const tool = 'Run a shell command inside the current workspace. Required: command. Preserve cwd, env, timeout, destructive warning, and command exactly.';
    const toolResult = await optimizePromptSurface({ surface: 'tool-definition', text: tool, requiredTerms: ['command', 'cwd', 'env', 'timeout'] });
    expect(toolResult.optimizedText).toContain('command');
    expect(toolResult.optimizedText).toContain('timeout');
    expect(toolResult.reasonCodes).toContain('tool-definition-minimized');
  });

  it('classifies surfaces, protects spans, and measures no-op optimization', () => {
    expect(classifyPromptSurface('---\nname: x\ndescription: Use when y\n---')).toBe('agent-skill');
    expect(classifyPromptSurface('---\nname: x\ntools: ["*"]\n---')).toBe('ghcp-agent');
    expect(classifyPromptSurface('GitHub Copilot instructions for this repo')).toBe('copilot-instructions');
    expect(classifyPromptSurface('tool function parameters required command')).toBe('tool-definition');
    expect(classifyPromptSurface('You are a helpful assistant')).toBe('system-prompt');

    const spans = protectPromptSpans('Security warning: stop.\nUse tool detok.\nPath .utk/file.raw.txt\nPriority: system > developer > user');
    expect(spans.map((span) => span.kind)).toEqual(['security', 'tool', 'path', 'priority']);

    const measured = measurePromptOptimization('same text', 'same text', []);
    expect(measured.savingsRatio).toBe(0);
    expect(measured.reasonCodes).toContain('no-op');
  });
});
