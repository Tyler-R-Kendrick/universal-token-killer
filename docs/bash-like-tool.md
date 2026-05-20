# Bash-Like Tool Templates

UTK includes an internal helper for bash-like tool invocation planning. It is
not a public CLI. It is a library surface for hook hosts, generated agents, and
tests that need compact command invocation templates.

For non-CLI structured parameters, use the companion
`completeStructuredToolInvocation` helper from `@utk/core`. Both helpers match
parameter values against literal `completions[]` from the tool definition.
**Per-field grammars are persisted only as `.lark` files** at
`.utk/tools/<normalized-tool-id>/fields/<normalized-field>.lark` — both the tool
id and the field name pass through `normalizeToolId` (lowercased; dots, spaces,
and other punctuation collapse to dashes), so a `tool.search` field `query.text`
lands at `.utk/tools/tool-search/fields/query-text.lark`. UTK does not write
`.grammar.json` sidecars and packs may not ship them — lint rejects packs that
include `.grammar.json` files.

## Purpose

CLI commands have stable structure: commands, subcommands, flags, options, and
known completions. UTK stores that structure as a `guidance-ts` grammar plus a
compact serialized template so future invocations can spend fewer tokens
describing the same command shape.

This helper is for invocation planning, not command execution. A host still has
to decide whether and how to run the returned `argv`.

The current implementation:

- accepts registered bash-like tool definitions;
- selects the best tool from the natural-language request;
- fills positional, flag, and option parameters from known completions;
- serializes a guidance grammar sidecar;
- stores a compact template through the configured serializer;
- reports missing required parameters instead of inventing arguments;
- falls back deterministically when no guidance runtime is configured.

## API

```ts
import { completeBashLikeToolInvocation } from '@utk/core';

const result = await completeBashLikeToolInvocation({
  workspaceRoot: process.cwd(),
  request: 'search packages for mediateToolExecution in TypeScript',
  tools: [
    {
      toolId: 'bash.rg',
      command: 'rg',
      description: 'Search text with ripgrep',
      parameters: [
        { name: 'pattern', kind: 'positional', completions: ['mediateToolExecution'], required: true },
        { name: 'path', kind: 'positional', completions: ['packages'], required: true },
        { name: 'globFlag', kind: 'flag', flag: '-g', completions: ['*.ts'] }
      ]
    }
  ]
});
```

The result includes:

- `invocation.command`: the planned command string;
- `invocation.argv`: shell-safe argument array;
- `templatePath`: compact template path under `.utk/tools/<normalized-tool-id>/templates/` (tool id passes through `normalizeToolId`, so dots and other punctuation become dashes on disk);
- `missingRequired`: required parameters that could not be completed;
- `guidance.serializedGrammar`: deterministic grammar sidecar;
- `guidance.available`: currently `false` when no guidance session is wired.

Current behavior is deliberately honest: UTK serializes a real `guidance-ts`
grammar, but if no guidance session is configured it marks `available: false`
and uses deterministic known-completion planning. It does not report fake
guided completion success.

## Artifact Layout

```text
.utk/tools/<normalized-tool-id>/templates/cli-template.compact.toon
.utk/tools/<normalized-tool-id>/templates/cli-template.compact.json
.utk/tools/<normalized-tool-id>/templates/cli-template.compact.tron
.utk/tools/<normalized-tool-id>/templates/cli-template.guidance.json
```

`<normalized-tool-id>` is `normalizeToolId(toolId)` — dots and other punctuation
become dashes on disk. Only one compact template is written, based on
`.utk/config.toml` serializer selection.

## Metrics

Bash rewrite metrics live in `packages/evals/metrics/bashRewriteMetrics.ts`.
The fixture-backed tests assert:

- exact command and argv match;
- argument accuracy is `1`;
- compact template token use beats RTK-style baselines;
- failing metrics name the scenario and failed value.

Run the focused checks:

```bash
npm test --workspace @utk/evals -- --run evals/bash-rewrite-metrics.test.ts
```

## Safety Rules

- Do not execute commands from this helper directly.
- Do not invent values for missing required parameters.
- Prefer `argv` over command-string parsing when a host executes the result.
- Keep generated templates under `.utk/` so command structure remains
  project-local and reviewable.
- Treat this as an internal hook/agent helper, not a package `bin`.
- Add eval fixtures before expanding a command family so accuracy and token
  savings remain measurable.
