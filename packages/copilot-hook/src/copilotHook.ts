import { compressTextWithLlmlingua2, loadUtkConfig, mediateToolExecution, type UtkConfig } from '@utk/core';
import type { CopilotPreToolUseOutput } from './copilotHookTypes.js';

export type CopilotHookOptions = {
  workspaceRoot: string;
};

type CopilotPayload = {
  tool_name?: string;
  toolName?: string;
  tool_input?: unknown;
  toolInput?: unknown;
  tool_output?: unknown;
  toolOutput?: unknown;
  result?: unknown;
  toolArgs?: unknown;
};

export async function processCopilotToolHookPayload(payloadText: string, options: CopilotHookOptions): Promise<string | undefined> {
  const payload = parsePayload(payloadText);
  if (!payload) return undefined;

  const toolId = payload.tool_name ?? payload.toolName;
  if (!toolId) return undefined;

  const output = observableOutput(payload);
  if (output === undefined) return undefined;

  const input = payload.tool_input ?? payload.toolInput ?? {};
  const result = await mediateToolExecution({
    workspaceRoot: options.workspaceRoot,
    toolId,
    input,
    execute: async () => output
  });

  return JSON.stringify({
    hookSpecificOutput: {
      updatedOutput: result.response
    }
  });
}

export async function processCopilotPreToolUsePayload(payloadText: string, options: CopilotHookOptions): Promise<string | undefined> {
  const payload = parsePayload(payloadText);
  if (!payload) return undefined;

  const toolId = payload.tool_name ?? payload.toolName;
  if (!toolId) return undefined;

  const args = observableArgs(payload);
  if (!isPlainObject(args)) return undefined;

  try {
    const config = await loadUtkConfig(options.workspaceRoot);
    const policy = effectiveDetokPolicy(config, toolId);
    if (!policy) return undefined;

    const rewritten = await rewriteToolArgs(args, policy);
    if (rewritten.error) return '{}';
    if (!rewritten.applied) return undefined;

    const output: CopilotPreToolUseOutput = { modifiedArgs: rewritten.value };
    return JSON.stringify(output);
  } catch {
    return '{}';
  }
}

function parsePayload(payloadText: string): CopilotPayload | undefined {
  try {
    const parsed = JSON.parse(payloadText) as unknown;
    if (!parsed || typeof parsed !== 'object') return undefined;
    return parsed as CopilotPayload;
  } catch {
    return undefined;
  }
}

function observableOutput(payload: CopilotPayload): unknown {
  if ('tool_output' in payload) return payload.tool_output;
  if ('toolOutput' in payload) return payload.toolOutput;
  if ('result' in payload) return payload.result;
  return undefined;
}

function observableArgs(payload: CopilotPayload): unknown {
  if ('toolArgs' in payload) return payload.toolArgs;
  if ('tool_input' in payload) return payload.tool_input;
  if ('toolInput' in payload) return payload.toolInput;
  return undefined;
}

type DetokFieldPolicy = {
  rate: number;
  minChars: number;
  rewriteFields: Set<string>;
  protectedFields: Set<string>;
};

function effectiveDetokPolicy(config: UtkConfig, toolId: string): DetokFieldPolicy | undefined {
  if (!config.detok.enabled) return undefined;
  const hook = config.detok.copilot_pre_tool_use;
  if (!hook.enabled) return undefined;

  const override = hook.overrides.find((item) => toolMatches(item.tool, toolId));
  if (override?.enabled === false) return undefined;
  if (hook.deny_tools.some((pattern) => toolMatches(pattern, toolId)) && override?.enabled !== true) return undefined;

  return {
    rate: hook.rate,
    minChars: hook.min_chars,
    rewriteFields: new Set(override?.rewrite_fields ?? hook.rewrite_fields),
    protectedFields: new Set(override?.protected_fields ?? hook.protected_fields)
  };
}

async function rewriteToolArgs(args: Record<string, unknown>, policy: DetokFieldPolicy): Promise<{ value: Record<string, unknown>; applied: boolean; error: boolean }> {
  let applied = false;
  let error = false;
  const entries = await Promise.all(
    Object.entries(args).map(async ([key, value]) => {
      const rewritten = await rewriteValueForField(key, value, policy);
      applied = applied || rewritten.applied;
      error = error || rewritten.error;
      return [key, rewritten.value] as const;
    })
  );

  return { value: Object.fromEntries(entries), applied, error };
}

async function rewriteValueForField(key: string, value: unknown, policy: DetokFieldPolicy): Promise<{ value: unknown; applied: boolean; error: boolean }> {
  if (policy.protectedFields.has(key)) return { value, applied: false, error: false };

  if (typeof value === 'string') {
    if (!policy.rewriteFields.has(key)) return { value, applied: false, error: false };
    const result = await compressTextWithLlmlingua2(value, { rate: policy.rate, minChars: policy.minChars });
    return {
      value: result.compressedText,
      applied: result.applied,
      error: Boolean(result.error)
    };
  }

  if (Array.isArray(value)) {
    let applied = false;
    let error = false;
    const items = await Promise.all(
      value.map(async (item) => {
        const rewritten = await rewriteValueForField(key, item, policy);
        applied = applied || rewritten.applied;
        error = error || rewritten.error;
        return rewritten.value;
      })
    );
    return { value: items, applied, error };
  }

  if (isPlainObject(value)) {
    const nested = await rewriteToolArgs(value, policy);
    return nested;
  }

  return { value, applied: false, error: false };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function toolMatches(pattern: string, toolId: string): boolean {
  if (pattern === toolId) return true;
  if (pattern.endsWith('*')) return toolId.startsWith(pattern.slice(0, -1));
  return false;
}
