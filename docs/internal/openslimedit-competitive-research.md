# OpenSlimedit Competitive Research

Internal note. Do not link this document from the public README unless the
competitive strategy becomes intentionally public.

Research date: 2026-05-19
Upstream repository: https://github.com/ASidorenkoCode/openslimedit
Observed upstream revision: `d5014929d6f66729b887df74a65ed6d22c3b522b`

## Install And Configuration Status

OpenSlimedit was researched from a temporary clone only. It was not installed
or configured in this workspace.

Documented upstream install path:

```jsonc
// .opencode/opencode.jsonc
{
  "plugin": ["openslimedit@latest"]
}
```

Documented package entrypoint:

```json
{
  "name": "openslimedit",
  "version": "1.0.4",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "peerDependencies": {
    "@opencode-ai/plugin": "*"
  }
}
```

Important caveats:

- OpenSlimedit is an OpenCode plugin, not a GitHub Copilot hook, MCP server,
  proxy, or CLI.
- The implementation is a single TypeScript file with no package scripts and
  no checked-in automated tests.
- The README claims "up to 45%" token reduction, while the package description
  still says "up to 33%." Treat the README as the newer product claim and the
  package metadata as stale.
- The README benchmark tables are valuable competitive evidence, but the repo
  does not include a reproducible benchmark harness or fixture set.
- `CONTRIBUTING.md` and `SECURITY.md` still refer to `open-hashline`, which
  suggests the project was renamed or pivoted without fully updating
  operational docs.
- The README says OpenSlimedit strips parameter descriptions, but the current
  source visibly mutates only top-level tool descriptions plus selected
  read/edit outputs. Verify this against the OpenCode hook object shape before
  assuming parameter-description compression exists.

## Core Positioning

OpenSlimedit is a minimal OpenCode plugin for reducing token usage in code-edit
sessions without adding custom tools or system-prompt rules. Its central thesis
is that built-in tool schemas and read/edit boilerplate create recurring input
token waste, and that many savings can be achieved by making existing tools
shorter rather than teaching models a new editing protocol.

This differs from UTK's intended center:

- OpenSlimedit compresses OpenCode tool definitions, read output boilerplate,
  and edit arguments.
- UTK mediates GitHub Copilot tool calls, persists raw artifacts, infers
  schemas, routes outputs, serializes compact responses, and handles shell and
  non-shell tool payloads through a hook-first architecture.

The overlap worth studying is OpenSlimedit's refusal to create a custom tool
surface. It shows that token wins may come from shrinking repeated host-provided
schemas and outputs while preserving familiar built-in tool behavior.

## Capability Inventory

| Capability | What it does | How OpenSlimedit implements it | UTK relevance |
|---|---|---|---|
| OpenCode plugin packaging | Installs into OpenCode with a package name in `.opencode/opencode.jsonc`. | Publishes an ESM package whose default export is an `@opencode-ai/plugin` plugin. | UTK should not copy the OpenCode plugin API for Copilot, but the tiny package surface is a good model for marketplace bundles. |
| Zero-config optimization | Starts optimizing sessions once installed. | Uses static hook behavior, no repo-local config, no user tuning. | UTK has stronger TOML configuration, but should keep default behavior low-friction. |
| Tool definition compression | Replaces verbose built-in tool descriptions with terse descriptions. | `tool.definition` hook maps tool ids such as `read`, `edit`, `apply_patch`, `bash`, `glob`, and `grep` to short strings. | High priority. If Copilot/plugin APIs expose tool definitions, UTK should add a schema/description minimization layer and score its savings separately from output serialization. |
| Built-in tool preservation | Avoids custom tools and system-prompt injection. | Mutates existing hook-provided tool metadata instead of introducing a new editing tool. | Strong design lesson. UTK's bash-like tool and detok MCP should prove that any new surface pays for its own schema overhead. |
| Compact read output | Removes low-value file-read wrapper text. | `tool.execute.after` for `read` strips `<type>file</type>` and the end-of-file footer. | Directly relevant to UTK serializers: boilerplate removal should be schema-aware and recoverable through raw artifacts. |
| Relative path shortening | Reduces absolute path noise in file reads. | Extracts `<path>...</path>`, converts paths under the workspace to relative paths, and rewrites the read output. | UTK should apply path-shortening in compact summaries, while preserving exact raw paths in artifacts. |
| Directory-read pass-through | Avoids changing directory listings. | If read output contains `<type>directory</type>`, the hook returns without modification. | Good conservative boundary. UTK should route directory listings separately from file contents. |
| Edit success compression | Collapses verbose successful edit output. | After an `edit` succeeds, replaces `Edit applied successfully...` output with `OK`. | Useful for UTK compact metadata, but only when raw execution result is persisted. |
| Line-range edit expansion | Lets the model use `oldString: "55-64"` instead of reproducing exact source text. | Before `edit`, if `oldString` is a line range and the exact old string is not already in the file, reads the target file and expands the range to exact file lines. | Very relevant to UTK's planned bash-like/structured invocation work. This is a compact invocation format that can be grammar-guided and artifact-verified. |
| Single-line range support | Allows `"55"` as shorthand for one line. | Regex accepts either `N` or `N-M`. | UTK can adopt this grammar with stricter validation and tests. |
| Absolute/relative path resolution | Locates the edit target on disk. | Resolves absolute paths directly or relative paths against the plugin `directory`. | UTK should enforce workspace-root containment before expanding edit ranges. |
| Fail-open behavior | Avoids blocking tools when expansion cannot be done. | Catches file-read errors and returns without modifying args. Invalid ranges are ignored. | Fits UTK hook behavior: fail open when optimization is unsafe or unobservable. |
| Hashline comparison | Compares against a hash-tagged line reference strategy. | README benchmark reports hashline adds overhead and sometimes fails, especially on multi-edit. | Important warning for UTK: extra schemas, tags, and prompt rules can erase theoretical savings. |
| Smart Edit comparison | Compares against a smaller line-range strategy. | README includes `smart_edit` for selected models. | UTK evals should include description-only, line-range-only, and full-mediation ablations. |
| Large-file scaling claim | Reports savings on 1k, 3k, 6k, and 10k line files. | README provides summarized token tables, including a 5-iteration average for GPT 5.3 Codex. | UTK should add comparable large-output fixtures and track whether savings scale with file size. |
| Minimal implementation | Keeps logic in one file. | `src/index.ts` contains plugin hooks, path conversion, and edit expansion. | Useful for clarity, but UTK's broader scope needs package boundaries, tests, and provider interfaces. |
| Stale inherited docs | Security and contribution docs mention `open-hashline`. | Repository docs were not fully updated after the current OpenSlimedit shape. | UTK should keep competitive docs, plugin manifests, skills, and security notes synchronized with actual shipped behavior. |

## Implementation Mechanics

### Tool Definition Hook

OpenSlimedit registers a `tool.definition` hook. It takes the hook-provided
tool definition output object and replaces `output.description` with a compact
string for known built-in tools:

- `read`: "Read file content."
- `edit`: "Edit file. oldString can be line range '55-64'."
- `apply_patch`: "Apply a patch to files."
- `write`: "Write file."
- `bash`: "Run shell command."
- `glob`: "Find files."
- `grep`: "Search in files."
- `list`: "List directory."
- `fetch`: "Fetch URL."

The key claim is not just the shortened text. The key claim is repetition:
tool schemas are sent with every model call, so even small description savings
compound across multi-step editing tasks.

UTK implication: output mediation alone may miss a major savings source. If
GitHub Copilot plugin/hook surfaces allow tool metadata customization, UTK
should compress tool descriptions and schemas with the same rigor used for
tool outputs.

### Read Output Compaction

For file reads, OpenSlimedit:

1. Skips directory outputs.
2. Finds the `<path>...</path>` wrapper.
3. Converts absolute workspace paths to relative paths.
4. Removes the `<type>file</type>` wrapper line.
5. Removes the `(End of file - total N lines)` footer.

This is a simple but high-signal reducer. It preserves the file body while
removing wrapper tokens that are useful for the agent runtime but repetitive for
the model.

UTK implication: this maps cleanly to a serializer or route stage for common
file-read envelopes. UTK should keep raw artifacts untouched, then emit a
compact model-facing view that removes boilerplate and normalizes path display.

### Edit Output Compaction

Successful edit output is replaced with `OK`.

This is aggressive but reasonable when the tool already succeeded and the
agent can recover exact details from the execution record. UTK should only do
this when the raw result is persisted and the compact response includes enough
metadata to locate the artifact.

### Line-Range Edit Expansion

OpenSlimedit treats an edit `oldString` matching `N` or `N-M` as a compact
reference to exact file lines. Before the edit executes, it reads the file and
replaces the line-range reference with the actual text slice.

This avoids forcing the model to reproduce large blocks exactly. It also avoids
introducing a custom edit tool, because OpenCode still receives a normal `edit`
call after expansion.

Risks and edge cases UTK should cover if adopting this:

- CRLF preservation and final-newline behavior.
- Workspace-root containment for resolved paths.
- Very large ranges that accidentally expand too much context.
- Stale line numbers after previous edits in the same turn.
- Multi-edit interactions where line numbers shift between replacements.
- Binary or non-UTF-8 files.
- Line range syntax accidentally colliding with a real desired old string.
- Recovery metadata showing which range expanded to which artifact.

### Benchmark Claims

The README reports these total token reductions against baseline:

| Model | Baseline tokens | OpenSlimedit tokens | Saved |
|---|---:|---:|---:|
| GPT 5.3 Codex | 77,494 | 42,509 | 45.1% |
| Claude Opus 4.6 | 60,841 | 47,590 | 21.8% |
| Claude Sonnet 4.5 | 120,884 | 81,471 | 32.6% |
| GPT 5.2 Codex | 39,185 | 28,713 | 26.7% |
| Minimax M2.5 Free | 28,031 | 21,073 | 24.8% |

The README says these were measured across four edit tasks:

- single-edit: 21-line file, change one word.
- multi-line-replace: 48-line file, rewrite a function body.
- multi-edit: 35-line file, three separate changes.
- large-file-edit: 115-line file, add try/catch plus retry logic.

It also reports large-file scaling for 1k to 10k line files, with Minimax
saving 11.0% to 18.7% and GPT 5.3 Codex saving 23.4% to 58.5%.

These numbers should be treated as competitive claims, not independently
verified facts. The repository snapshot does not include benchmark scripts,
raw fixtures, or transcripts.

## Competitive Implications For UTK

OpenSlimedit's strongest lesson is that host tool metadata can dominate token
cost. UTK has focused heavily on tool output compaction, recoverability, schema
routing, and generalized non-shell payloads. That remains the right
architecture for GitHub Copilot tool mediation, but UTK should also score the
cost of repeated tool definitions where the host integration exposes them.

OpenSlimedit also suggests that custom tools are not automatically better.
The README reports that a hashline strategy increased token usage for several
models because tagged read output, custom schemas, and extra prompt
instructions outweighed shorter edit references. UTK's planned bash-like tool,
`detok` MCP, and generated agents/skills should include schema-overhead
accounting so a new surface is added only when it beats built-in behavior.

Where UTK is already stronger:

- UTK persists raw artifacts locally; OpenSlimedit rewrites outputs in place.
- UTK supports shell and non-shell tool output mediation; OpenSlimedit targets
  a small set of OpenCode built-in tools.
- UTK has pluggable serializers and TOML policy; OpenSlimedit is static.
- UTK has RTK parity and comparative metric infrastructure; OpenSlimedit
  publishes benchmark tables without checked-in reproducer code.
- UTK's hook behavior is intended to be GitHub Copilot-native rather than
  OpenCode-specific.

Where OpenSlimedit currently outflanks UTK conceptually:

- It directly attacks repeated tool schema/description overhead.
- It keeps the model on familiar built-in tools instead of requiring a new
  invocation protocol.
- It has a very simple install story and clear product claim.
- Its line-range edit trick converts a common exact-string burden into compact
  structured input.

## Competitive Opportunities For UTK

1. Add a tool-definition/schema compression research track for Copilot plugin
   and hook surfaces, if the real API supports it.
2. Add an OpenSlimedit-style editing fixture set to `packages/evals`: single
   edit, multi-line replace, multi-edit, and large-file edit.
3. Add ablation metrics for output-only compression, tool-description-only
   compression, line-range-only rewriting, and full UTK mediation.
4. Extend the bash-like structured invocation work to support safe line-range
   references with llguidance grammars.
5. Store line-range expansion events in `.utk/` artifacts so compact edit
   invocations remain recoverable.
6. Add a "schema overhead" metric that scores any UTK custom tool against the
   built-in host tool it replaces.
7. Add a compact file-read route that removes path/type/footer boilerplate
   while preserving raw output and exact source text in artifacts.
8. Add stable path-shortening rules to serializers: relative display paths in
   compact text, exact absolute paths only in raw artifacts or recovery
   metadata.
9. Add regression tests for operational docs and marketplace manifests so stale
   renamed-project text does not survive in UTK releases.
10. Keep public claims tied to reproducible fixture-backed evals, unlike
    OpenSlimedit's currently README-only benchmark evidence.

## Suggested UTK Eval Additions

OpenSlimedit-style fixtures should sit beside RTK parity scenarios because they
measure edit-loop token use rather than shell-output token use.

Recommended scenarios:

| Scenario | Raw behavior | UTK behavior to score | Required facts |
|---|---|---|---|
| Single word edit | Model receives file read and must edit one token. | Compact read envelope plus exact raw artifact. | Target file, old word, new word, success status. |
| Multi-line replacement | Model replaces a function body. | Optional line-range invocation plus artifact-backed expansion. | Function name, start/end lines, replacement summary, success status. |
| Multi-edit | Several edits in one file. | Track line shifts and artifact recovery across each edit. | All changed ranges, all replacements, final success status. |
| Large file edit | Model edits a small block in a large file. | Compact file read and line-range edit with raw recovery. | Edited region, surrounding anchors, success status. |
| Tool schema overhead | Host sends verbose tool metadata repeatedly. | Compare baseline tool schemas against UTK-compressed metadata, if API permits. | Tool ids, compressed descriptions, token deltas. |
| Custom tool penalty | New UTK tool replaces a built-in. | Compare custom schema overhead to built-in compressed behavior. | Accuracy, step count, total tokens, failure rate. |

Metrics to add:

- `toolDefinitionTokensBefore`
- `toolDefinitionTokensAfter`
- `toolDefinitionSavingsRatio`
- `editInvocationTokensBefore`
- `editInvocationTokensAfter`
- `lineRangeExpansionAccuracy`
- `lineRangeRecoverabilityScore`
- `customToolOverheadTokens`
- `builtinVsCustomTokenRatio`

## Risks And Non-Goals

- Do not copy OpenCode hook semantics into GitHub Copilot without verifying the
  real Copilot hook/plugin contract.
- Do not mutate operational edit fields unless the expansion is exact,
  workspace-contained, and recoverable.
- Do not strip raw payloads. OpenSlimedit optimizes in place; UTK's advantage
  is compact model output plus artifact recovery.
- Do not adopt hashline-style line tags without proving that schema and prompt
  overhead are lower than the savings.
- Do not publish benchmark claims without fixture-backed reproducibility.
- Do not make UTK a public CLI to chase OpenCode install ergonomics. Use
  Copilot hooks, marketplace plugin metadata, skills, and internal runners.

## Source Files Reviewed

Temporary clone path:

```text
%TEMP%\utk-openslimedit-research
```

Reviewed upstream files:

- `README.md`: positioning, install path, benchmark tables, stated design
  goals, and hashline comparison.
- `src/index.ts`: actual OpenCode plugin hooks and implementation mechanics.
- `package.json`: package metadata, entrypoint, peer dependency, and stale
  "up to 33%" description.
- `CONTRIBUTING.md`: development assumptions and stale `open-hashline` text.
- `SECURITY.md`: security claims and stale `open-hashline` threat model.
- `.github/ISSUE_TEMPLATE/*` and `.github/PULL_REQUEST_TEMPLATE.md`: minimal
  project maintenance templates.

Primary source URLs:

- https://github.com/ASidorenkoCode/openslimedit
- https://github.com/ASidorenkoCode/openslimedit/blob/master/src/index.ts
- https://github.com/ASidorenkoCode/openslimedit/blob/master/package.json
