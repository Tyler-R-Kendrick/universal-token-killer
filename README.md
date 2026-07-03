# Universal Token Killer

UTK is a hook-first token optimizer for GitHub Copilot tool calls. It captures observable shell and non-shell tool outputs, stores full-fidelity raw artifacts under `.utk/`, and returns compact, schema-aware references to chat instead of dumping bulky payloads into the model context.

It is designed as a generalized successor to `rust-token-killer`: RTK-style wins for CLI output, plus structured tool-output mediation, TOON serialization, schema routing, constrained routing fallback, and project-local recovery artifacts.

UTK's mediation surface is the Copilot tool-hook pipeline — not a public mediation CLI or VS Code extension. Tool-output mediation always runs through the hook path. The repo does ship a few local operator binaries around that core — the `utk` pack manager (installing and validating optimization packs) and the `utk-model-proxy` context gateway — plus a local `detok` MCP helper for LLMLingua-2 prompt rewriting and internal helpers for grammar-guided tool invocation. None of these replaces the hook pipeline as the way tool output is mediated.

## Why UTK

- **Spend fewer tokens on tool output:** UTK returns compact summaries and artifact references instead of raw command dumps.
- **Keep the facts recoverable:** raw outputs, compact artifacts, schemas, routes, and validation metadata are written to `.utk/`.
- **Handle more than shell:** shell and non-shell tool calls use the same mediation path whenever Copilot exposes input/output.
- **Stay configurable:** choose `toon` or `json-compact` globally or per tool in `.utk/config.toml`.
- **Rewrite LLM-bound text locally:** `detok` uses LLMLingua-2 to simplify inputs and post-schema output text before it reaches a model.
- **Reuse session-specific expertise:** `utk-init` can prepare `.utk/session-agents` and `.utk/session-skills` so repeated work becomes compact, discoverable project context.
- **Stay measurable:** benchmark suites assert token savings plus fact retention, recoverability, relevance, correctness, groundedness, and strict wins over checked-in competitor baselines.

## Scope

UTK's core is **tool-output mediation** for the Copilot hook pipeline described above. Three adjacent axes extend that core rather than replace it, each sharing the same discipline — compact model-visible text, full-fidelity recoverable artifacts, and measured savings:

- **Assistant-prose compression** — the `AGENTS.md` "Caveman" terse modes for human-facing summaries.
- **Code-authoring minification** — `@utk/codegen`, grammar-grounded min code generation with deterministic pretty expansion at the user boundary.
- **Context-gateway proxy** — `@utk/model-proxy`, an OpenAI-compatible local proxy that compacts repeated history and tool schemas.

Each axis is measured against a checked-in competitor baseline; see [Packages](#packages) for where the code lives.

## Benchmark Snapshot

Five benchmarks — tool-output, long-context, needle-in-a-haystack, tool-selection, agent-workflows — each run baseline, every competitor, and UTK as sibling arms over the same cases. Full comparison, Pareto charts, headline numbers, and regression gates: `docs/features/evals/benchmark-summary.md`. Regenerate everything with `npm run evals --workspace @utk/evals`.

> Self-authored deterministic self-comparison: competitor arms are configured models of each technique run against the same benchmark data — the vendors' live systems are not installed or run. Token counts and fact retention are real (coarse `ceil(len/4)` token estimate); **cost and latency are modeled** by a deterministic reference cost model, not measured on a live endpoint. Read these as reproducible internal self-comparisons that gate fact retention, not head-to-head results against live systems.

Cross-benchmark summary — `token reduction / task success` at each technique's primary operating point; ★ marks the cost-vs-success Pareto frontier for that benchmark:

| Technique | Tool output | Long-context | Needle | Tool selection | Agent workflows |
| --- | ---: | ---: | ---: | ---: | ---: |
| Baseline (raw context) | 0% / 100% | 0% / 100% | 0% / 100% | 0% / 100% | 0% / 100% |
| RTK (rust-token-killer) | −13% / 100% ★ | −65% / 50% | −89% / 60% | −36% / 80% | −30% / 80% |
| LeanCTX (context runtime) | −12% / 100% | −56% / 90% | −87% / 100% ★ | −26% / 100% | −20% / 90% |
| Compresr (query-aware) | −14% / 100% ★ | −58% / 90% ★ | −87% / 100% ★ | −30% / 100% ★ | −20% / 90% |
| Caveman (terse register) | −17% / 92% | −76% / 50% | −90% / 40% | −96% / 10% | −37% / 70% |
| Ponytail (minimum emission) | −25% / 92% ★ | −77% / 50% ★ | −90% / 30% | −96% / 10% | −43% / 50% |
| UTK (mediated compaction) | −75% / 100% ★ | −83% / 100% ★ | −93% / 100% | −70% / 100% | −78% / 100% ★ |

UTK holds **100% task success on every benchmark** while cutting 70–93% of visible tokens, and sits on the Pareto frontier in four of five. The honest exception is needle-in-a-haystack: query-aware extractors (LeanCTX/Compresr) reach the buried needle inline more cheaply than UTK's handle plus recovery round-trip, so they — not UTK — hold that frontier. Aggressive in-context compactors (Caveman/Ponytail) top the token-reduction column but fail the regression gate on most benchmarks by dropping required facts (task success collapses). Tool-selection is where compaction turns dangerous: dropping the needed tool can leave a destructive one as the surviving selection — an unsafe-tool error the gate is built to catch (it flags RTK's on that benchmark). Cutting the most tokens is not winning — the frontier is. Harness, metrics, graders, and data format: `docs/features/evals/evals.md`; full report: `docs/features/evals/benchmark-summary.md`.

## LeanCTX Copilot Benchmark

The LeanCTX Copilot suite compares UTK against a context-runtime baseline across Copilot prompt surfaces, post-tool output, and deferred tool-schema discovery. It runs 50 unique cases across 10 repeated improvement loops and 3 internal rounds per loop.

- Total evaluated cases: `1,500`
- Failed comparisons: `0`
- UTK tokens: `108,750`
- LeanCTX baseline tokens: `163,980`
- Total estimated token savings vs LeanCTX: `55,230`
- Savings vs LeanCTX: `33.68%`
- Minimum relevance/correctness/groundedness: `1.000`

Full report: `docs/competition/lean-ctx/parity-benchmark.md`.

## Example Usage

### Discover The Skills With skills.sh

UTK bundles `agentskills.io`-compatible skills under root `skills/`. They can be discovered by the `skills.sh` CLI directly from the repository:

```bash
npx skills add . --list
```

The list should include `utk`, `utk-init`, `detoks`, `detoks-skill`, and `model-proxy`. Install one skill by selecting it from the same source:

```bash
npx skills add . --skill utk-init
```

### Install The Copilot Plugin Bundle

UTK also ships a GitHub Copilot CLI plugin marketplace at `.github/plugin/marketplace.json`. The marketplace points to focused plugin roots under `packages/plugins/agents/copilot/plugins`:

```bash
copilot plugin marketplace add .
copilot plugin install utk-cli@universal-token-killer
copilot plugin install utk-model-proxy@universal-token-killer
copilot plugin install utk-detoks@universal-token-killer
```

After local edits, reinstall the plugin so Copilot refreshes its cached copy:

```bash
copilot plugin install ./packages/plugins/agents/copilot/plugins/utk-detoks
```

### Initialize A Project With The Agent Skill

Use `skills/utk-init` when first adding UTK to a project. It discovers registered tools, accepts optional tool-specific descriptions or samples, and seeds `.utk/` schema artifacts for every selected shell and non-shell tool.

It also initializes dynamic reuse locations:

- `.utk/session-agents`, linked into `.github/agents` when no concrete `.github/agents` directory already exists.
- `.utk/session-skills`, linked into `.agents/skills` when no concrete `.agents/skills` directory already exists.

Example prompt:

```text
Use utk-init for this repo. Initialize all registered tools. For github.pull-request.list, expect JSON objects with number, title, author, state, labels, and url. For shell.git.diff, use json-compact.
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

For prompt-specific compression, prefer the CLI `detoks-prompt` surface so large prompt text can stay in files or stdin instead of being pasted into chat context. It compresses only natural-language spans and preserves fenced code, indented code, inline code, Markdown blockquotes, and quoted strings:

```bash
node packages/cli/dist/utk.js detoks-prompt --file prompt.md --rate 0.33
Get-Content .\prompt.md -Raw | node packages/cli/dist/utk.js detoks-prompt --stdin
```

Prompt compression reads `.utk/config.toml`:

```toml
[detok.prompt]
model = "default/LLMLingua2"
rate = 0.33
min_chars = 0
```

Model ids use `<provider>/<model>`. `default/LLMLingua2` is built in. `Hugging-Face/Kompress-small` is recognized as an optional local adapter when its inference package is installed.

### Complete A Bash-Like Tool Invocation

UTK includes an internal, non-public helper for bash-like tool invocation templates. It uses `guidance-ts` to serialize known completions, stores the compact template under `.utk/tools/<normalized-tool-id>/templates/` (tool id passes through `normalizeToolId`), and returns a deterministic invocation when a guidance runtime is unavailable.

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
      { name: 'short', kind: 'flag', flag: '--short', completions: ['--short', 'compact'], description: 'compact' }
    ]
  }]
});

console.log(result.invocation.command); // git status --short
```

### Complete A Structured LLM Tool Invocation

UTK supports structured tool parameters with cache-aware invocation planning. Per-field grammars are **`.lark` only** — packs ship a `.lark` and UTK persists it at `.utk/tools/<normalized-tool-id>/fields/<normalized-field>.lark` (both ids pass through `normalizeToolId`, so dots and other punctuation become dashes on disk). `.grammar.json` sidecars are not supported and are rejected by `lintPack`. The tool definition just names the fields and any canonical example completions:

```ts
import { completeStructuredToolInvocation } from '@utk/core';

const result = await completeStructuredToolInvocation({
  workspaceRoot: process.cwd(),
  request: 'search open issue bugs',
  tools: [{
    toolId: 'tool.search',
    outputCache: true,
    bypassOnCache: true,
    parameters: [{ name: 'query', completions: ['is:issue is:open label:bug'], required: true }]
  }]
});
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

[serialization.providers.json-compact]
enabled = true

[serialization.providers.tron]
enabled = true

[plugins]
serialization_paths = [".utk/plugins/serialization"]

[[serialization.overrides]]
tool = "shell.git.diff"
provider = "json-compact"

[routing]
deterministic_confidence_threshold = 0.95
constrained_routing_enabled = true

[persistence]
raw_outputs = true
storage_root = ".utk"

[detok]
enabled = true

[detok.prompt]
model = "default/LLMLingua2"
rate = 0.33
min_chars = 0

[detok.copilot_pre_tool_use]
enabled = true
rate = 0.33
min_chars = 8000
deny_tools = ["bash", "powershell", "create", "edit", "view", "grep", "glob"]
rewrite_fields = ["prompt", "instructions", "description", "question", "message", "summary", "notes", "body"]
protected_fields = ["command", "cmd", "path", "file", "files", "cwd", "url", "pattern", "regex", "glob", "patch", "diff", "content", "old_string", "new_string", "id"]

[tools]
registry = []
```

Built-in serializers are `toon`, `json-compact`, and `tron`. Maintained serializers live in `packages/plugins/serialization`; workspace serializers load from `.utk/plugins/serialization/<plugin-name>` as data-only packs using `utk.pack.toml`, a `symbol` const name, an index const export, and `grammar/<id>.lark`. Installed serializer packs under `.utk/packs/<pack-name>` are loaded the same way. Serialization packs declare `semantics = "json-value-v1"` and cannot execute plugin-local code. Core generates parser, serializer, linter, AST feedback, and compatibility provider surfaces under `registry.serializers[PLUGIN_SERIALIZER]`.

## Packages

UTK is a layered, acyclic workspace: reusable primitives sit at the bottom, the mediation core builds on them, and use-case packages and apps build on the core.

**Reusable primitives** (no or few internal dependencies):

- `@utk/foundation`: the shared kernel — token estimation, canonical hashing, atomic writes, tool-id normalization, and path-safety. Depended on by nearly everything, so it carries no upward edges.
- `@utk/config`: `.utk/config.toml` loading and normalization.
- `@utk/tracing`: run contexts, Jaeger-style spans, GenAI tags, failure recording, and trace persistence.
- `@utk/constrained-decoder`: the single `guidance-ts` facade — the constrained-decoding runtime (`completeWithGrammar`, llguidance adapter) plus the shared invocation-grammar DSL (`nonEmptyChoices` and materialized `grm`/`gen`/`select`/`str`). The only package that depends on `guidance-ts`.
- `@utk/grammar`: `.lark` grammar-file loading (`createGrammarReader`), the shared basis for llguidance constrained decoding against lark grammars.
- `@utk/minmap`: the whole min-representation system — min maps (format/allocator/patch/journal), the declare-before-use patch grammars, and derivative token-optimized min-grammar generation (`deriveMinGrammar`).
- `@utk/detok`: local LLMLingua-2 prompt/text compression with protected-span segmentation.
- `@utk/templates`: the prompt-template DSL and its grammar-completion port.

**Mediation core:**

- `@utk/core`: the tool-output mediation engine — mediation pipeline, routing, rules, response compaction, schema inference/merge, the serialization registry + serializer grammar codec, artifact/workspace stores, stream persistence, schema history, and the pack format + installer. (Serialization and pack stay together in core: serialization loads serializer packs, so the two are mutually cohesive.) Re-exports the primitives above as a compatibility facade.

**Use-case packages** (build on the core and primitives):

- `@utk/context-optimization`: tool discovery/matching (exact/regex/lexical/embedding), session ledgers, context budget/policy, and artifact recovery/proof.
- `@utk/prompt-optimization`: deterministic prompt-surface compaction.
- `@utk/session-artifacts`: session-agent and session-skill generation (`.utk/session-agents`, `.utk/session-skills`).
- `@utk/tool-invocation`: grammar-backed bash-like and structured tool-invocation completion, plus the Copilot tool hook.
- `@utk/code-graph`: TypeScript-compiler-API code-graph SDK for reuse detection and RAG; underpins `@utk/codegen`.
- `@utk/codegen`: language-agnostic grammar-grounded code generation — macro expansion, the formalized decision-ladder planner, constrained codegen with honest fallback, and the language-pack registry. Consumes `@utk/grammar`, `@utk/minmap`, and `@utk/templates`.
- `@utk/lang-typescript`: the reference codegen language pack (`packages/plugins/languages/typescript`) — TypeScript adapter, codegen-profile grammars, and capability indexes. Future languages (python, java, kotlin, cpp, csharp, rust, ...) land as sibling folders under `packages/plugins/languages/`.

**Apps and adapters:**

- `@utk/cli`: `utk` binary for installing, removing, listing, and validating packs, plus `detoks-prompt`.
- `@utk/model-proxy`: OpenAI-compatible local context gateway (`utk-model-proxy` binary) that compacts repeated history and tool schemas before forwarding upstream, with recoverable `.utk/model-proxy` artifacts. See [Model Proxy](docs/features/model-proxy/model-proxy.md).
- `@utk/copilot-hook`: Copilot hook payload adapter for observable tool calls, maintained under `packages/plugins/agents/copilot`.
- `@utk/detok-mcp`: private local stdio MCP server exposing the `detok` LLMLingua-2 tool (depends on `@utk/detok`).
- `@utk/evals`: the comparison harness (baseline vs competitor vs UTK), jsonl benchmark data, code/LLM/composite graders, generated AgentV suites, and the agentevals.io evaluator protocol.

## Sharing Optimizations As Packs

Tool definitions, Lark grammars (for llguidance constrained decoding), and prompt-template DSL files travel together as a versioned **pack**. Install one with the `utk` CLI:

```bash
utk pack add ./my-git-pack            # local directory
utk pack add ./git-cli-1.2.0.tgz      # tarball
utk pack add github:alice/utk-pack-git#v1.2.0
utk pack add @utk/git-cli@^1.0.0      # npm registry

utk pack list
utk pack remove git-cli
utk pack lint ./my-git-pack           # validate pack format (exits 1 on errors)
utk pack lint ./my-git-pack --strict  # treat warnings as errors (use in CI)
```

`utk pack add` runs the linter and refuses to install packs with errors. Pass `--force` after re-checking the report if you need to override.

The installer writes the pack into `.utk/packs/<name>/`, merges its tool definitions into `tools.registry` in `.utk/config.toml` (with `# utk-pack-begin:` / `# utk-pack-end:` markers so uninstall is reversible), drops `.lark` grammars into `.utk/tools/<normalized-tool-id>/fields/<normalized-field>.lark` (both ids pass through `normalizeToolId` so dots and other punctuation become dashes on disk; **`.grammar.json` is not used** — UTK persists grammars as `.lark` only), caches template descriptors at `.utk/cache/templates/`, exposes declared `[[plugins]]` from the installed pack root, and records the install in `.utk/packs.lock.toml`.

**Safety:**

- `lintPack`/`installPack` do **not** dynamic-import pack template modules by default — the default lint emits a `pack/templates/runtime-validation-skipped` finding instead. Callers that want full runtime validation pass `{ importTemplate: importTemplateForLint }`. This is the difference between a pack lint that is safe to run on untrusted input and one that is RCE-equivalent.
- Pack names that contain path-traversal segments (`../`, etc.) are rejected by the installer — destination paths use a two-level `safeJoin` against `.utk/packs`.
- Install is **crash-safe**: all persistent writes go through `atomicWriteFile` (write-to-temp + `rename`) and the lockfile is written last. A power loss between writes leaves the system reporting the pack as not installed; mid-write tearing of any single file is prevented by the rename-on-commit pattern.

Authoring a pack:

```text
my-pack/
├── utk.pack.toml             # manifest (name, version, tools, grammars, templates, plugins)
├── tools/<id>.toml           # bash-like or structured tool definitions
├── grammars/<tool>/<field>.lark         # llguidance-ready grammar
# .lark is the ONLY supported grammar artifact — no .grammar.json sidecars
├── templates/<name>.template.ts         # prompt-template DSL (TS) — .py also supported
├── index.ts                             # data-only serializer id const export
└── grammar/<plugin>.lark                # data-only serialization plugin grammar for json-value-v1
```

## Reference Docs

- [Quickstart](docs/features/getting-started/quickstart.md)
- [Architecture](docs/features/architecture/architecture.md)
- [Agent Skills](docs/features/skills/agent-skills.md)
- [Bash-Like Tool Templates](docs/features/serialization/bash-like-tool.md)
- [Copilot Hook Integration](docs/features/copilot-hook/copilot-hook.md)
- [Configuration](docs/features/getting-started/configuration.md)
- [Detok MCP](docs/features/detok/detok-mcp.md)
- [Session Agents And Skills](docs/features/skills/session-artifacts.md)
- [Serialization Providers](docs/features/serialization/serialization.md)
- [Artifacts And Recovery](docs/features/architecture/artifacts.md)
- [Security And Privacy](docs/features/architecture/security-and-privacy.md)
- [Schema Routing](docs/features/serialization/schema-routing.md)
- [Constrained Decoding](docs/features/serialization/constrained-decoding.md)
- [RTK Parity](docs/features/evals/rtk-parity.md)
- [Evals](docs/features/evals/evals.md)
- [Tracing](docs/features/evals/tracing.md)
- [Evals-Driven Iteration](docs/features/evals/evals-driven-iteration.md)
- [Spec Reference: agentevals.io](docs/features/evals/references/agentevals-spec.md)
- [Reference: Tracing Failure Codes](docs/features/evals/references/tracing-failure-codes.md)
- [Reference: Evaluator Config Keys](docs/features/evals/references/evaluator-config.md)
- [Reference: Baseline Store](docs/features/evals/references/baseline-store.md)
- [Implementation Guide](docs/features/getting-started/implementation-guide.md)
- [Troubleshooting](docs/features/getting-started/troubleshooting.md)

## Development

```bash
npm install
npm run typecheck
npm run build
npm test
npm run coverage
```

Coverage is expected to remain at 100% statements, branches, functions, and lines.
