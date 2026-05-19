# Universal Token Killer

UTK is a hook-first token optimizer for GitHub Copilot tool calls. It captures observable shell and non-shell tool outputs, stores full-fidelity raw artifacts under `.utk/`, and returns compact, schema-aware references to chat instead of dumping bulky payloads into the model context.

It is designed as a generalized successor to `rust-token-killer`: RTK-style wins for CLI output, plus structured tool-output mediation, TOON serialization, schema routing, constrained routing fallback, and project-local recovery artifacts.

UTK is not a public CLI or VS Code extension. Its primary mediation surface is the Copilot tool-hook pipeline. The repo also ships a local `detok` MCP helper for LLMLingua-2 prompt rewriting and internal helpers for grammar-guided tool invocation.

## Why UTK

- **Spend fewer tokens on tool output:** UTK returns compact summaries and artifact references instead of raw command dumps.
- **Keep the facts recoverable:** raw outputs, compact artifacts, schemas, routes, and validation metadata are written to `.utk/`.
- **Handle more than shell:** shell and non-shell tool calls use the same mediation path whenever Copilot exposes input/output.
- **Stay configurable:** choose `toon` or `compressed-json` globally or per tool in `.utk/config.toml`.
- **Rewrite LLM-bound text locally:** `detok` uses LLMLingua-2 to simplify inputs and post-schema output text before it reaches a model.
- **Reuse session-specific expertise:** `utk-init` can prepare `.utk/session-agents` and `.utk/session-skills` so repeated work becomes compact, discoverable project context.
- **Stay measurable:** RTK parity tests assert fact retention, recoverability, savings, and strict CLI wins over checked-in RTK baselines.

## RTK Parity Stats

The fixture-backed parity suite currently verifies that UTK beats RTK baselines for CLI-related tool calls:

| Scenario | UTK tokens | RTK tokens | Delta | Ratio |
| --- | ---: | ---: | ---: | ---: |
| `shell-git-status` | 5 | 21 | +16 | 0.24 |
| `shell-git-diff` | 5 | 23 | +18 | 0.22 |
| `shell-gh-pr-list` | 6 | 19 | +13 | 0.32 |
| `shell-rg` | 5 | 18 | +13 | 0.28 |
| `shell-vitest` | 5 | 10 | +5 | 0.50 |
| `shell-tsc` | 5 | 21 | +16 | 0.24 |

Each scenario also requires `factRetentionScore === 1` and `recoverabilityScore === 1`.

## Example Usage

### Discover The Skills With skills.sh

UTK bundles `agentskills.io`-compatible skills under root `skills/`. They can be discovered by the `skills.sh` CLI directly from the repository:

```bash
npx skills add . --list
```

The list should include `utk`, `utk-init`, and `detoks`. Install one skill by selecting it from the same source:

```bash
npx skills add . --skill utk-init
```

### Install The Copilot Plugin Bundle

UTK also ships a GitHub Copilot CLI plugin marketplace at `.github/plugin/marketplace.json`, mirroring the official GitHub and Microsoft plugin layout. The plugin bundle exposes the UTK skills, a UTK operator agent, and the local `detok` MCP server configuration:

```bash
copilot plugin marketplace add .
copilot plugin install universal-token-killer@universal-token-killer
```

After local edits, reinstall the plugin so Copilot refreshes its cached copy:

```bash
copilot plugin install ./.github/plugins/universal-token-killer
```

### Initialize A Project With The Agent Skill

Use `skills/utk-init` when first adding UTK to a project. It discovers registered tools, accepts optional tool-specific descriptions or samples, and seeds `.utk/` schema artifacts for every selected shell and non-shell tool.

It also initializes dynamic reuse locations:

- `.utk/session-agents`, linked into `.github/agents` when no concrete `.github/agents` directory already exists.
- `.utk/session-skills`, linked into `.agents/skills` when no concrete `.agents/skills` directory already exists.

Example prompt:

```text
Use utk-init for this repo. Initialize all registered tools. For github.pull-request.list, expect JSON objects with number, title, author, state, labels, and url. For shell.git.diff, use compressed-json.
```

### Rewrite Text With Detok MCP

Install the local Python compressor and build the workspace:

```bash
python -m pip install -r requirements-detok.txt
npm install
npm run build
```

The workspace registers `detok` in `.vscode/mcp.json` for VS Code/GitHub Copilot. Ask Copilot to use the `detok` MCP tool when a prompt or artifact is too bulky:

```text
Use detok to rewrite this output at rate 0.33 before reasoning over it.
```

Agents can load `skills/detoks` for when/how guidance around the local MCP tool.

### Complete A Bash-Like Tool Invocation

UTK includes an internal, non-public helper for bash-like tool invocation templates. It uses `guidance-ts` to serialize known completions, stores the compact template under `.utk/tools/<tool-id>/templates/`, and returns a deterministic invocation when a guidance runtime is unavailable.

```ts
import { completeBashLikeToolInvocation } from '@utk/core';

const result = await completeBashLikeToolInvocation({
  workspaceRoot: process.cwd(),
  request: 'show compact git status',
  tools: [{
    toolId: 'bash.git.status',
    command: 'git',
    parameters: [
      { name: 'subcommand', kind: 'positional', completions: ['status'], required: true },
      { name: 'short', kind: 'flag', flag: '--short', completions: ['--short'] }
    ]
  }]
});

console.log(result.invocation.command); // git status --short
```

### Mediate A Tool Call

```ts
import { mediateToolExecution } from '@utk/core';

const result = await mediateToolExecution({
  workspaceRoot: process.cwd(),
  toolId: 'shell.git.diff',
  input: { command: 'git diff -- packages/evals' },
  execute: async () => runOriginalTool()
});

console.log(result.response);
```

Example compact response:

```text
Tool result stored at: .utk/tools/shell-git-diff/observations/<run>/output.raw.txt
Schema: shell-git-diff.v1.<hash>
Serializer: toon
Compact artifact: .utk/tools/shell-git-diff/observations/<run>/output.compact.toon
Route confidence: 1.00
Full payload was written to disk and omitted from chat context.
```

### Process A Copilot Hook Payload

```ts
import { processCopilotToolHookPayload } from '@utk/copilot-hook';

const output = await processCopilotToolHookPayload(JSON.stringify({
  tool_name: 'read_file',
  tool_input: { path: 'src/index.ts' },
  tool_output: { contents: 'export const value = 1;' }
}), {
  workspaceRoot: process.cwd()
});
```

Malformed, unobservable, or unsupported hook events return `undefined` so the caller can pass them through safely.

## Configuration

UTK initializes `.utk/config.toml` on first use:

```toml
[serialization]
default = "toon"

[serialization.providers.toon]
enabled = true

[serialization.providers.compressed-json]
enabled = true

[[serialization.overrides]]
tool = "shell.git.diff"
provider = "compressed-json"

[routing]
deterministic_confidence_threshold = 0.95
constrained_routing_enabled = true

[persistence]
raw_outputs = true
storage_root = ".utk"

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

## Packages

- `@utk/core`: mediation, persistence, schema/rule/routing artifacts, config, serializers, detok helpers, bash-like templates, and session artifact helpers.
- `@utk/copilot-hook`: Copilot hook payload adapter for observable tool calls.
- `@utk/constrained-decoder`: `guidance-ts` constrained routing helpers.
- `@utk/detok-mcp`: private local stdio MCP server exposing the `detok` LLMLingua-2 tool.
- `@utk/evals`: RTK parity fixtures, metrics, assertions, and AgentV-style eval definitions.

## Reference Docs

- [Quickstart](docs/quickstart.md)
- [Architecture](docs/architecture.md)
- [Agent Skills](docs/agent-skills.md)
- [Bash-Like Tool Templates](docs/bash-like-tool.md)
- [Copilot Hook Integration](docs/copilot-hook.md)
- [Configuration](docs/configuration.md)
- [Detok MCP](docs/detok-mcp.md)
- [Session Agents And Skills](docs/session-artifacts.md)
- [Serialization Providers](docs/serialization.md)
- [Artifacts And Recovery](docs/artifacts.md)
- [Security And Privacy](docs/security-and-privacy.md)
- [Schema Routing](docs/schema-routing.md)
- [Constrained Decoding](docs/constrained-decoding.md)
- [RTK Parity](docs/rtk-parity.md)
- [Evals](docs/evals.md)
- [Implementation Guide](docs/implementation-guide.md)
- [Troubleshooting](docs/troubleshooting.md)

## Development

```bash
npm install
npm run typecheck
npm run build
npm test
npm run coverage
```

Coverage is expected to remain at 100% statements, branches, functions, and lines.
