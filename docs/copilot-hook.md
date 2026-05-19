# Copilot Hook Integration

UTK mediates Copilot tool-hook payloads when the event exposes enough data to be observed safely.

## Supported Payload Shapes

The hook adapter recognizes:

- `tool_name` or `toolName`
- `tool_input` or `toolInput`
- `tool_output`, `toolOutput`, or `result`

If a payload is malformed, has no tool id, or has no observable output, the adapter returns `undefined` so the host can pass the event through.

## Example

```ts
import { processCopilotToolHookPayload } from '@utk/copilot-hook';

const mediated = await processCopilotToolHookPayload(JSON.stringify({
  tool_name: 'shell.git.status',
  tool_input: { command: 'git status --short' },
  tool_output: ' M README.md\n?? docs/copilot-hook.md\n'
}), {
  workspaceRoot: process.cwd()
});
```

When mediation succeeds, the result is a hook-specific output envelope:

```json
{
  "hookSpecificOutput": {
    "updatedOutput": "Tool result stored at: ..."
  }
}
```

## Pass-Through Policy

Only unobservable or unsafe events pass through. Non-shell tool calls are in scope whenever their input and output are visible in the hook payload.

## Shell And Non-Shell Examples

Shell output:

```json
{
  "tool_name": "shell.git.diff",
  "tool_input": { "command": "git diff -- README.md" },
  "tool_output": "diff --git a/README.md b/README.md\n..."
}
```

Structured tool output:

```json
{
  "toolName": "workspace.symbols",
  "toolInput": { "query": "processCopilotToolHookPayload" },
  "toolOutput": {
    "symbols": [
      {
        "name": "processCopilotToolHookPayload",
        "file": "packages/copilot-hook/src/copilotHook.ts"
      }
    ]
  }
}
```

Both shapes are mediated when the output is observable. The compact response points to `.utk/` artifacts for recovery.
