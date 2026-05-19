# OpenCode DCP Competitive Research

Internal note. Do not link this document from the public README unless the
competitive strategy becomes intentionally public.

Research date: 2026-05-19
Upstream repository: https://github.com/Opencode-DCP/opencode-dynamic-context-pruning
Observed upstream revision: `0657cd2fd50e9891cd69eae3787bcf280fabc2ba`

## Install And Configuration Status

OpenCode Dynamic Context Pruning was researched from the public repository and
a temporary clone only. It was not installed or configured in this workspace.

Documented upstream install path:

```powershell
opencode plugin add npm:@tarquinen/opencode-dcp
```

The package is published as `@tarquinen/opencode-dcp` and declares
`@opencode-ai/plugin` as a peer dependency. Its primary configuration file is
documented as:

```text
~/.config/opencode/dcp.jsonc
```

Important caveats:

- DCP is OpenCode-specific. It is not a GitHub Copilot hook, MCP server, or
  generalized tool-output mediation layer.
- DCP exposes model-visible compression behavior through a `compress` tool and
  `/dcp` slash commands.
- The upstream license is `AGPL-3.0-or-later`, so UTK should study concepts and
  avoid copying implementation code.
- DCP stores session state under the user's OpenCode data directory, while UTK
  should keep project-local recovery artifacts under `.utk/`.

## Core Positioning

OpenCode DCP is a conversation-history pruning and compression plugin. It keeps
OpenCode sessions smaller by prompting the model to summarize older conversation
ranges, replacing older raw context with compact summary blocks, pruning
superseded tool outputs, and removing stale failed tool-call inputs.

This differs from UTK's desired center:

- DCP compresses conversation context inside OpenCode.
- UTK mediates GitHub Copilot tool calls, persists raw tool artifacts, infers
  schemas, routes results, and returns compact serialized tool responses.

The overlap worth studying is DCP's lifecycle design: visible message/block IDs,
protected content policies, recoverable compression blocks, stats, context
limit nudges, manual decompression, and automated stale-output strategies.

## Capability Inventory

| Capability | What it does | How DCP implements it | UTK relevance |
|---|---|---|---|
| OpenCode plugin hooks | Inserts DCP behavior into OpenCode's model and tool loop. | Registers `experimental.chat.system.transform`, `experimental.chat.messages.transform`, `experimental.text.complete`, `command.execute.before`, `event`, `tool.compress`, and `config` hooks. | UTK should map comparable behavior onto Copilot hook events without becoming OpenCode-specific. |
| Model-visible `compress` tool | Lets the model replace old conversation sections with summaries. | Adds a `compress` tool unless permission/config disables it. The model supplies a topic and either message ranges or message summaries. | Useful pattern for optional agent-visible compaction, but UTK's source of truth must remain raw artifacts plus schemas. |
| Range compression mode | Compresses contiguous spans identified by generated IDs. | Assigns `mNNNN` message IDs and `bN` block IDs, validates non-overlapping ranges, preserves nested block placeholders, and writes synthetic compressed blocks. | UTK can reuse the ID-and-block mental model for session summaries and recoverable compact artifacts. |
| Message compression mode | Compresses selected messages independently. | The tool accepts `messageId`, per-message `topic`, and `summary` records, then applies compression state to those exact messages. | Useful for non-contiguous tool result summarization, especially when a whole range contains active context. |
| Compression prompts | Teaches the model what summaries must preserve. | System and tool prompts require technical detail retention, exact paths, decisions, blockers, file references, and coherent nested-summary expansion. | UTK skills can adopt similar preservation requirements, but serialization should remain deterministic where possible. |
| Context-limit nudges | Pushes the model to compress as context grows. | Uses configured min/max context limits, model-specific limits, nudge frequency, and forced critical warnings above thresholds. | UTK can add warnings or skill guidance when tool artifacts or session state begin consuming large budgets. |
| Deduplication strategy | Removes older duplicate tool calls. | Groups completed tool calls by tool name and normalized parameters, respects protected tools and protected file patterns, then prunes older duplicate outputs. | Directly relevant to UTK artifact routing: repeated `rg`, `git status`, and diagnostics can be compacted by identity. |
| Purge-errors strategy | Removes stale failed tool-call inputs. | Replaces old errored tool string inputs after a configurable turn threshold while preserving protected tools/files. | UTK can use a similar policy for failed shell/tool artifacts while keeping raw recovery files. |
| Protected tools | Prevents important tool outputs from being pruned or compressed away. | Defaults include `task`, `skill`, `todowrite`, `todoread`, `compress`, `batch`, `plan_enter`, `plan_exit`, `write`, and `edit`. | UTK should maintain protected tool IDs and field policies for hooks, detok rewriting, and artifact compression. |
| Protected file patterns | Avoids pruning tool calls touching important paths. | Extracts file paths from tool inputs and supports glob-style protected file patterns. | Strong pattern for UTK: schema routing and compression should preserve high-risk files and generated patches. |
| Protected prompt tags | Preserves specific prompt-tagged content. | Supports configured tags and user-message protection during compression. | Useful for UTK session skills and subagents where user instructions should survive aggressive compaction. |
| Decompression | Restores previously compressed blocks. | `/dcp decompress` reactivates compressed context, handles parent/ancestor constraints, updates stats, and persists state. | UTK should offer artifact recovery and expansion affordances for compact hook responses. |
| Recompression | Re-applies user-decompressed blocks. | `/dcp recompress` restores compression if the origin message still exists in the session. | UTK can mirror this with compact artifact regeneration from raw payloads and schema history. |
| Stats and context report | Shows token savings and context composition. | `/dcp stats` and `/dcp context` combine OpenCode-reported tokens, tokenizer estimates, and per-session saved-token stats. | UTK docs and evals should surface per-scenario savings, raw-vs-compact ratios, and recoverability. |
| Manual mode | Lets users trigger compression deliberately. | Slash commands and manual state control when the next compression may run. | UTK can keep automatic hook mediation conservative while exposing explicit skill-driven init/recovery workflows. |
| Slash commands | Provides an operator interface. | `/dcp`, `/dcp context`, `/dcp stats`, `/dcp compress`, `/dcp manual`, `/dcp sweep`, `/dcp decompress`, and `/dcp recompress`. | UTK must not become a public CLI, but agent skills can expose comparable operations as skill workflows. |
| Persistent session state | Remembers compression, pruning, nudges, and stats. | Writes JSON state under OpenCode's plugin storage directory keyed by session ID. | UTK should store analogous state in `.utk/` for project-local portability and reviewability. |
| Token estimation | Estimates context and savings. | Uses `@anthropic-ai/tokenizer.countTokens` with a character-count fallback. | UTK can reuse the "accurate when possible, deterministic fallback" policy in metrics and reports. |
| Subagent controls | Avoids or adapts behavior for internal agents. | Detects internal agent signatures and config gates for `experimental.allowSubAgents`. | UTK's generated session agents should be explicit about when hooks/skills apply to subagent work. |
| Hallucination stripping | Removes invented DCP tags from text completions. | `experimental.text.complete` strips hallucinated DCP metadata tags. | UTK should test that compact metadata does not leak or hallucinate as user-facing content. |
| Auto-update check | Notifies about plugin updates. | Configurable update check logic runs from the plugin. | Not central to UTK; avoid adding update behavior unless package distribution requires it. |

## Implementation Mechanics

### Hook Pipeline

DCP's main plugin entrypoint creates a session-scoped state object, loads JSONC
configuration, initializes prompt and permission helpers, and registers OpenCode
hooks. The message-transform hook is the core path. It validates message shape,
syncs permissions and tool IDs, strips hallucinated metadata, caches system
prompt token counts, assigns stable message references, synchronizes compression
blocks, runs pruning strategies, injects compression nudges, injects message
IDs, handles manual compression triggers, and persists context state.

This is model-context surgery, not tool mediation. The plugin rewrites what the
model sees in the conversation, while UTK should rewrite tool responses and
persist raw payloads before compacting.

### Compression Tool

DCP's `compress` tool has two modes:

- `range`: summarize a contiguous range from `startId` to `endId`.
- `message`: summarize selected messages by `messageId`.

Both modes require a top-level topic and structured summary content. Range mode
has more complex block handling because ranges may include prior compressed
blocks. Those blocks are represented as `(bN)` placeholders, and the prompt
requires the model to preserve or expand them exactly once so nested summaries
remain coherent.

### Compression State

Compression state records active block IDs, consumed nested blocks, direct and
effective message IDs, direct and effective tool IDs, creation timing, summary
tokens, compressed-token estimates, and stats. DCP emits synthetic user messages
with a `[Compressed conversation section]` header and footer metadata. During
message transforms, raw messages covered by active compression blocks are
filtered out and replaced by compact summary messages at anchor positions.

The strongest UTK lesson is to treat compact output as an indexable layer, not
the only copy. UTK should preserve raw payloads and schema artifacts even when a
compact response is returned to the model.

### Automated Pruning

DCP ships two automatic strategies:

- `deduplication`: identifies older duplicate tool calls by normalized
  tool-name-plus-parameters identity and prunes superseded outputs.
- `purge-errors`: removes stale failed tool-call inputs after a configurable
  turn threshold.

The pruning layer replaces removed content with short placeholders instead of
deleting whole messages. Some tool types are excluded from output pruning, such
as question/edit/write-like interactions where the result may be essential.

### Protection Model

DCP has several safety boundaries:

- protected tool names;
- protected tool-name glob patterns;
- protected file path patterns;
- protected tags in prompt content;
- optional user-message protection;
- compression permission modes: `ask`, `allow`, and `deny`.

This policy model is directly relevant to UTK. Copilot hooks, LLMLingua input
rewrites, schema serialization, and generated session skills all need explicit
protected fields/tools so optimization cannot corrupt execution semantics.

### Persistence And Recovery

DCP writes per-session JSON state to OpenCode's plugin storage directory. That
state includes pruned tool/message maps, compression blocks, nudge anchors,
token stats, and update timestamps. Recovery is exposed through decompression
and recompression commands rather than raw file artifacts.

UTK should keep a stricter recovery story: raw input/output artifacts,
serialized artifacts, schema history, and route summaries under `.utk/`, with
skills and hooks able to reference those files.

### Metrics And Reporting

DCP reports savings through command output and notifications. It blends model
reported token usage, cached system prompt estimates, tokenizer counts, and
fallback estimates. Its reports include context composition, tool-output
pruning, compressed block counts, and saved-token totals.

UTK's RTK parity metrics already align with this direction. The useful addition
from DCP is session-level reporting: what was compressed, when, why, whether it
is recoverable, and how much it saved across a chat rather than a single tool
call.

## Competitive Opportunities For UTK

1. Add DCP-style stable message/tool/block IDs to UTK session artifacts so
   compact responses can reference recoverable payloads precisely.
2. Add session-level savings reports that combine per-tool metrics, artifact
   counts, schema-route confidence, and raw-vs-compact token ratios.
3. Implement dedupe and purge-error policies over `.utk/` artifacts while
   preserving raw outputs.
4. Use protected tool and protected field policies consistently across Copilot
   hooks, detok rewriting, serializers, and generated skills.
5. Let UTK session skills create "compression blocks" for recurring reasoning
   work, but keep the raw artifacts and schemas as the authoritative source.
6. Add a decompression-style recovery skill that expands compact hook responses
   from raw artifacts and schema history.
7. Generate context-limit nudges for skills/subagents when `.utk/` sees repeated
   large outputs from the same tool family.
8. Benchmark DCP-style conversation pruning separately from UTK tool-call
   mediation so the product does not blur into a general conversation compressor.
9. Use JSONC/TOML schema validation patterns for explicit config errors and
   safe defaults.
10. Keep UTK integrations project-local and Copilot-specific where requested,
    avoiding DCP's OpenCode-only runtime assumptions.

## Risks To Avoid

- Do not make model-generated summaries the only source of truth.
- Do not prune or rewrite raw outputs without a recoverable `.utk/` artifact.
- Do not copy AGPL-licensed implementation code.
- Do not turn UTK into an OpenCode plugin or public CLI to chase DCP parity.
- Do not expose an agent-visible compression tool that can mutate execution
  context without deterministic validation and recovery.
- Do not compress operational inputs such as commands, paths, patches, globs,
  regexes, IDs, or exact error strings.
- Do not let stats become vanity metrics; required facts and artifact recovery
  should remain pass/fail gates.

## Source Files Reviewed

Public source:

- https://github.com/Opencode-DCP/opencode-dynamic-context-pruning

Temporary clone at revision `0657cd2fd50e9891cd69eae3787bcf280fabc2ba`:

- `README.md`
- `package.json`
- `dcp.schema.json`
- `index.ts`
- `lib/config.ts`
- `lib/hooks.ts`
- `lib/compress/range.ts`
- `lib/compress/message.ts`
- `lib/compress/pipeline.ts`
- `lib/compress/state.ts`
- `lib/messages/prune.ts`
- `lib/strategies/deduplication.ts`
- `lib/strategies/purge-errors.ts`
- `lib/prompts/system.ts`
- `lib/prompts/compress-range.ts`
- `lib/prompts/compress-message.ts`
- `lib/prompts/context-limit-nudge.ts`
- `lib/state/persistence.ts`
- `lib/token-utils.ts`
- `lib/protected-patterns.ts`
- `lib/commands/context.ts`
- `lib/commands/stats.ts`
- `lib/commands/decompress.ts`
- `lib/commands/recompress.ts`
