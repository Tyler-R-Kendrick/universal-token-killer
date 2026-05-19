# Architecture

UTK is a mediation layer between GitHub Copilot tool events and model-visible responses. The full tool result is preserved on disk, while chat receives a compact response with recovery references and schema/routing metadata.

## Data Flow

1. A Copilot hook or host integration observes a tool id, tool input, and tool output.
2. `mediateToolExecution` writes the raw input under `.utk/tools/<tool-id>/observations/<run-id>/input.json`.
3. UTK optionally writes `input.detok.json` when local LLMLingua-2 compression applies to LLM-bound input text.
4. The original tool output is persisted as `output.raw.json`, `output.raw.txt`, or `output.raw.bin`.
5. UTK infers an output schema and generic structural rules from the raw output or binary/stream envelope.
6. The schema is merged into per-tool history and route indexes.
7. A configured serializer writes a compact artifact in TOON or compressed JSON.
8. The caller receives a short response that references the raw and compact artifacts.

```mermaid
flowchart LR
  Hook["Copilot hook event"] --> Core["mediateToolExecution"]
  Core --> Raw["Raw artifact"]
  Core --> Schema["Schema + rules"]
  Schema --> Route["Route index"]
  Core --> Compact["Compact artifact"]
  Raw --> Response["Compact response"]
  Compact --> Response
  Route --> Response
```

## Core Principles

- **Hook-first:** UTK mediation is designed for tool hooks, not for direct end-user CLI usage.
- **Local detok helper:** the `detok` MCP server is a local LLMLingua-2 text rewriting helper, not a replacement mediation surface.
- **Payload safe:** raw payloads are written to disk and omitted from chat context.
- **Recoverable:** compact responses always point back to raw artifacts.
- **Generalized:** schema inference and routing are based on shape, not command-specific special cases.
- **Measurable:** RTK parity metrics enforce savings, fact retention, and artifact recovery.
- **Generated reuse:** `utk-init` can materialize dynamic session agents and session skills under `.utk/` so repeated project work is referenced instead of re-explained.

## Integration Surfaces

UTK currently exposes several surfaces with different constraints:

| Surface | Purpose | Public CLI? |
|---|---|---:|
| `@utk/core` | Mediation, artifacts, serializers, config, bash-like templates, session agent/skill generation. | No |
| `@utk/copilot-hook` | GitHub Copilot hook payload adapters and the internal `preToolUse` detok runner. | No |
| `@utk/constrained-decoder` | `guidance-ts` grammar helpers for constrained route fallback. | No |
| `@utk/detok-mcp` | Private local MCP server exposing LLMLingua-2 rewriting as `detok`. | MCP only |
| `@utk/evals` | Fixture-backed parity, safety, and bash rewrite metrics. | No |

## Runtime Packages

- `@utk/core` owns mediation, config, persistence, serializers, schemas, routing, and recovery artifacts.
- `@utk/copilot-hook` adapts Copilot hook JSON to core mediation.
- `@utk/constrained-decoder` owns `guidance-ts` route grammar helpers.
- `@utk/detok-mcp` owns the private local stdio MCP server for the `detok` tool.
- `@utk/evals` owns parity fixtures, metrics, and assertions.

## Related Docs

- [Quickstart](quickstart.md)
- [Copilot Hook Integration](copilot-hook.md)
- [Artifacts And Recovery](artifacts.md)
- [Bash-Like Tool Templates](bash-like-tool.md)
- [Session Agents And Skills](session-artifacts.md)
- [RTK Parity](rtk-parity.md)
