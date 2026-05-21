# Copilot Hook Integration

UTK mediates Copilot tool-hook payloads when the event exposes enough data to be observed safely. It also ships a conservative `preToolUse` LLMLingua hook for safe, LLM-bound tool input fields.

## Hook Registration

GitHub Copilot hook files use the official `version: 1` format with a top-level `hooks` object. Command hook entries must declare `type: "command"` and one of `bash`, `powershell`, or `command`.

The repo-local hook is `.github/hooks/utk-detok-inputs.json`:

```json
{
  "version": 1,
  "hooks": {
    "preToolUse": [
      {
        "type": "command",
        "command": "node packages/copilot-hook/dist/detokPreToolUseHook.js",
        "cwd": ".",
        "env": {
          "UTK_WORKSPACE_ROOT": "${workspaceFolder}"
        },
        "timeoutSec": 30
      }
    ]
  }
}
```

The Copilot plugin bundle also includes `hooks/hooks.json`, as supported by the Copilot CLI plugin layout. That plugin hook points at `hooks/detokPreToolUseHook.js`, a fail-open wrapper shipped inside the plugin. The wrapper delegates to the workspace UTK hook runner when this source repo is present and returns `{}` when it cannot find a runner.

## Supported Payload Shapes

The hook adapter recognizes:

- `tool_name` or `toolName`
- `tool_input` or `toolInput`
- `tool_output`, `toolOutput`, or `result`

If a payload is malformed, has no tool id, or has no observable output, the adapter returns `undefined` so the host can pass the event through.

For `preToolUse` input rewriting, the hook recognizes:

- `toolName` or `tool_name`
- `toolArgs`, `tool_input`, or `toolInput`

GitHub's reference payloads are `toolName`/`toolArgs` for `preToolUse` and `tool_name`/`tool_input` for `PreToolUse`, the VS Code-compatible PascalCase event form. UTK accepts both so one runner can support both surfaces.

When rewriting succeeds, the hook returns:

```json
{
  "modifiedArgs": {
    "prompt": "compressed prompt text"
  }
}
```

GitHub's hook contract allows `preToolUse.modifiedArgs` to replace tool arguments. `userPromptSubmitted` can observe submitted prompts, but it does not provide a prompt replacement path, so UTK does not claim to rewrite user prompts directly.

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

The LLMLingua input hook is fail-open. It returns `undefined` or `{}` when payloads are malformed, tools are denied, inputs are short, no allowlisted prose fields are present, or the local LLMLingua runtime is unavailable.

By default the hook rewrites only long natural-language fields named `prompt`, `instructions`, `description`, `question`, `message`, `summary`, `notes`, or `body`. It never rewrites operational fields such as commands, paths, globs, regexes, file contents, patches, diffs, old/new edit strings, cwd, env, URLs, or ids. Default denied tools include `bash`, `powershell`, `create`, `edit`, `view`, `grep`, and `glob`.

Configure this in `.utk/config.toml`:

```toml
[detok]
enabled = true

[detok.copilot_pre_tool_use]
enabled = true
rate = 0.33
min_chars = 8000
deny_tools = ["bash", "powershell", "create", "edit", "view", "grep", "glob"]
rewrite_fields = ["prompt", "instructions", "description", "question", "message", "summary", "notes", "body"]
protected_fields = ["command", "cmd", "path", "file", "files", "cwd", "url", "pattern", "regex", "glob", "patch", "diff", "content", "old_string", "new_string", "id"]
```

The repo hook lives at `.github/hooks/utk-detok-inputs.json`. The Copilot plugin bundle also includes `hooks/hooks.json`. GitHub combines repository, user, and plugin hooks, so enable one path per workspace to avoid double compression.

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

## Benchmark Coverage

Copilot-specific context behavior is covered by the LeanCTX Copilot benchmark:

- 50 unique cases across prompt surfaces, tool output, and tool-schema discovery.
- 10 repeated loops, 3 rounds per loop, 1,500 total evaluated cases.
- 0 failed comparisons.
- UTK token savings vs LeanCTX baseline: 55,230 tokens, 33.68%.
- Minimum relevance, correctness, and groundedness: 1.000.

Standalone report: [LeanCTX Copilot benchmark results](internal/leanctx-copilot-benchmark-results.md). Aggregate table: [benchmark summary](internal/benchmark-summary.md).
