# Universal Token Killer

UTK is a hook-first token optimizer for GitHub Copilot tool calls. It captures observable shell and non-shell tool outputs, stores full-fidelity raw artifacts under `.utk/`, and returns compact, schema-aware references to chat instead of dumping bulky payloads into the model context.

It is designed as a generalized successor to `rust-token-killer`: RTK-style wins for CLI output, plus structured tool-output mediation, TOON serialization, schema routing, constrained routing fallback, and project-local recovery artifacts.

UTK is not a public CLI, VS Code extension, or MCP server. Its primary surface is the Copilot tool-hook mediation pipeline.

## Why UTK

- **Spend fewer tokens on tool output:** UTK returns compact summaries and artifact references instead of raw command dumps.
- **Keep the facts recoverable:** raw outputs, compact artifacts, schemas, routes, and validation metadata are written to `.utk/`.
- **Handle more than shell:** shell and non-shell tool calls use the same mediation path whenever Copilot exposes input/output.
- **Stay configurable:** choose `toon` or `compressed-json` globally or per tool in `.utk/config.toml`.
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
```

## Packages

- `@utk/core`: mediation, persistence, schema/rule/routing artifacts, config, serializers.
- `@utk/copilot-hook`: Copilot hook payload adapter for observable tool calls.
- `@utk/constrained-decoder`: `guidance-ts` constrained routing helpers.
- `@utk/evals`: RTK parity fixtures, metrics, assertions, and AgentV-style eval definitions.

## Reference Docs

- [Quickstart](docs/quickstart.md)
- [Architecture](docs/architecture.md)
- [Copilot Hook Integration](docs/copilot-hook.md)
- [Configuration](docs/configuration.md)
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
