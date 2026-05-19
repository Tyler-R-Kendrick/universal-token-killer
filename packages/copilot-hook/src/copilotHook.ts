import { mediateToolExecution } from '@utk/core';

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
