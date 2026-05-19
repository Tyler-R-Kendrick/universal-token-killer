# Cavekit Competitive Research

Internal note. Do not link this document from the public README unless the
competitive strategy becomes intentionally public.

Research date: 2026-05-19
Upstream repository: https://github.com/JuliusBrussee/cavekit
Observed upstream revision: `823ad0437d03134f1ce6eb46baeb2145e18e95ad`
Observed frozen v3.1.0 revision: `9aa1905f7d00dea479751f703e775bb1513f8532`

## Install And Configuration Status

Cavekit was researched from the public repository and temporary shallow clones
of both current `main` and frozen tag `v3.1.0`. It was not installed, run, or
configured in this UTK workspace.

Documented current v4 install paths:

```bash
npx skills add JuliusBrussee/cavekit
/plugin marketplace add juliusbrussee/cavekit
/plugin install ck@cavekit
git clone https://github.com/juliusbrussee/cavekit.git ~/.claude/plugins/cavekit
```

Documented v3.1.0 install paths:

```bash
/plugin marketplace add juliusbrussee/cavekit@v3.1.0
/plugin install ck@cavekit
git clone -b v3.1.0 https://github.com/juliusbrussee/cavekit.git
```

Important caveats:

- Cavekit v4 is a Claude Code plugin and skills bundle for compressed
  spec-driven development. It is not a tool-output mediator, serializer, MCP
  server, or Copilot hook implementation.
- Cavekit v4 intentionally removed hooks, binaries, TypeScript helpers,
  dashboards, subagents, parallel workers, Codex peer review, design-system
  workflow, and the old `context/kits/` tree.
- Cavekit v3.1.0 is still important competitive research because it had the
  larger autonomous loop: hooks, stop-hook state machine, tool-result caching,
  condensed test output, parallel subagents, worktrees, Go CLI/TUI, team mode,
  model routing, Codex review, and task token budgets.
- The current repo is MIT licensed.

## Core Positioning

Cavekit's current value proposition is "compressed spec-driven development":
one durable `SPEC.md`, three commands, no orchestration. It argues that the spec
is the only artifact that earns repeated context tokens. Everything else should
either reduce future tokens, reduce human attention, or be removed.

This differs from UTK's intended center:

- Cavekit compresses and stabilizes project intent across build sessions.
- UTK mediates GitHub Copilot tool calls, persists raw outputs, infers schemas,
  routes outputs, and returns compact recoverable responses.

The overlap worth studying is high-level architecture discipline: durable
compact artifacts, addressable sections, invariant backpropagation from
failures, read-only drift checks, and aggressive removal of token-expensive
runtime ceremony.

## Capability Inventory

| Capability | What it does | How Cavekit implements it | UTK relevance |
|---|---|---|---|
| Single durable spec | Keeps project intent in one compact artifact. | v4 writes `SPEC.md` at repo root. Every command reads it. | Directly relevant to `.utk/` manifests and summaries: one canonical artifact should be easy to inspect and survive context resets. |
| Fixed section schema | Makes spec content addressable and grep-friendly. | `FORMAT.md` fixes order: `§G` goal, `§C` constraints, `§I` interfaces, `§V` invariants, `§T` tasks, `§B` bugs. | UTK route/schema summaries should use stable, addressable sections so agents can cite exactly which fact or route they rely on. |
| Caveman spec encoding | Shrinks loaded spec text. | Uses fragments, symbols, pipe tables, and protected verbatim spans for code, paths, URLs, identifiers, numbers, errors, SQL, and regex. | Strong reference for compact metadata. UTK can use TOON/compressed JSON for machines and caveman-style terse summaries for humans, while preserving raw artifacts. |
| Three-command loop | Reduces command surface. | v4 has `/ck:spec`, `/ck:build`, and `/ck:check` only. | Useful product lesson: UTK should expose few high-value skills/actions, not recreate a broad CLI. |
| Spec mutator | Creates, amends, distills, or backprops the spec. | `/ck:spec` and `skills/spec` are the only general spec writers. Dispatch modes are NEW, DISTILL, BACKPROP, and AMEND. | UTK should keep clear write ownership for `.utk/` schema and route records. Avoid many components editing the same artifact freely. |
| Code-to-spec distillation | Infers a spec from an existing codebase. | `/ck:spec from-code` walks repo, infers goal, constraints, interfaces, invariants, tasks, and empty bug log. | Relevant to `utk-init`: generate schemas/templates from registered tools and observed outputs, flag uncertain parts instead of inventing certainty. |
| Build loop | Implements selected spec tasks. | `/ck:build` reads `SPEC.md`, plans against cited invariants/interfaces, flips task status `.` to `~` to `x`, runs verification, and stops on failures for backprop. | UTK eval loops should tie implementation claims to invariant-like metrics: fact retention, recoverability, no raw leakage, token thresholds. |
| Read-only drift check | Compares spec against code. | `/ck:check` classifies invariants as HOLD/VIOLATE/UNVERIFIABLE, interfaces as MATCH/DRIFT/MISSING/EXTRA, tasks as pending/wip/stale. | Strong pattern for UTK artifact health checks: route/schema drift should be classified with evidence and never silently fixed in read-only mode. |
| Bug backprop | Converts failures into durable spec memory. | `skills/backprop` traces root cause, appends a `§B` row, usually adds a new `§V`, writes a test, fixes code, and commits together. | Very relevant. UTK should turn recurring compression failures into new schema/routing invariants and regression fixtures. |
| Invariant-first tests | Makes every new invariant prove itself. | Backprop says "new invariant without test = lie" and names tests with invariant IDs. | UTK already needs this discipline for serializer drift, protected spans, and RTK parity regressions. |
| Pipe-table tasks and bugs | Compresses repeating records. | `§T` table uses `id|status|task|cites`; `§B` uses `id|date|cause|fix`. | Similar to TOON's value: compact rows for repeated structures. UTK can use this in human-facing summaries while official serializers handle machine payloads. |
| Monotonic IDs | Prevents ambiguity over time. | `§V`, `§B`, and `§T` IDs are never reused. | UTK schema IDs, route IDs, and artifact IDs should remain stable and monotonic, not recycled. |
| Preserve technical spans | Avoids damaging critical facts. | `FORMAT.md` and `skills/caveman` explicitly preserve code, paths, URLs, identifiers, numbers, versions, errors, SQL, regex, JSON, YAML, and quoted strings. | Directly relevant to LLMLingua guardrails, detok hooks, compressed JSON redaction, and TOON validation. |
| No hidden orchestration in v4 | Keeps runtime surface tiny. | README non-goals: no subagents, dashboards, parallel workers, hooks, orchestration binaries, or TS helpers. | Useful warning. UTK should avoid adding broad orchestration unless it demonstrably saves more tokens than it costs. |
| Skills-first install | Lets agents activate workflow by context. | `npx skills add` installs `spec`, `build`, `check`, `caveman`, and `backprop` into Claude skills. | UTK's `skills/` marketplace surface should follow focused skills with explicit triggers and references. |
| Plugin packaging | Provides slash commands for Claude Code marketplace. | `plugin.json` declares plugin name `ck`, description, and version `4.0.0`; `commands/` mirrors skills for `/ck:*`. | UTK's GitHub Copilot plugin bundle should keep manifest and hook files valid, but not assume Claude's plugin schema. |
| v3 autonomous loop | Earlier full framework for long-running builds. | v3 `/ck:make` used stop hooks, `.cavekit/` state, task registry, locks, heartbeat, task budgets, and wave prompts. | Competitive reference for long-running agent state, but UTK should remain hook-first and not become a build orchestrator. |
| v3 tool-result cache | Avoided repeat tool calls. | `hooks/tool-cache.js` cached read-only Bash/Read/Grep/Glob results under `.cavekit/tool-cache`, denied repeated tool execution, and returned cached output as a system message. | Highly relevant to token savings. UTK could cache repeated safe read-only tool calls, but must include invalidation, raw artifact identity, and no mutation bypass. |
| v3 test-output condensation | Reduced huge test outputs. | `hooks/test-output-filter.js` detected common test commands, kept failure-context windows and tail lines, then injected condensed additional context. | Directly relevant to RTK parity. UTK can mediate `vitest`, `tsc`, `pytest`, etc. with schema-backed failure summaries and raw recovery artifacts. |
| v3 auto-backprop hook | Flagged failures for follow-up spec update. | PostToolUse Bash hook `auto-backprop.js` participated in the failure-to-spec loop. | UTK should create regression fixtures from failed compression/routing cases automatically or through a skill, not just patch once. |
| v3 token monitor | Tracked budget pressure. | `token-monitor.sh` and `.cavekit` config had session and per-task budgets. | UTK metrics should display per-tool-call savings and budget pressure in `.utk/` reports. |
| v3 model routing | Chose model tiers by role/task. | `cavekit-router.cjs` and config mapped roles to haiku/sonnet/opus baselines with cost weights. | Useful for optional subagent/session-agent design, but UTK core should not depend on model-specific routing. |
| v3 Go CLI/TUI | Managed build sessions and worktrees. | `cmd/cavekit` exposed `monitor`, `status`, `team`, `kill`, `version`, `debug`, and `reset`; internal packages managed tmux, TUI, worktrees, sites, sessions, and team state. | Out of scope for UTK's non-CLI boundary, but useful as a contrast: UTK should not drift into a public operational CLI. |
| v3 team mode | Coordinated multiple people/devices. | Team package used claims, heartbeats, ledger, refs, and pre-commit guard concepts. | Future UTK session-agents/session-skills can learn from claims and scoped ownership, but `.utk/` should stay project-local and simple first. |
| v3 Codex review bridge | Used a second model for adversarial review. | `/ck:review --codex` called `scripts/codex-review.sh`, wrote findings, and compared reviewer agreement. | UTK evals can compare providers/serializers, but should not require external peer review for baseline operation. |

## Implementation Mechanics

### v4 Spec Format

The current format is intentionally a small grammar:

```text
# SPEC
## §G GOAL
## §C CONSTRAINTS
## §I INTERFACES
## §V INVARIANTS
## §T TASKS
## §B BUGS
```

Interfaces are written as externally visible surfaces such as commands, APIs,
files, and environment variables. Invariants are testable rules. Tasks cite the
interfaces and invariants they implement. Bugs cite the invariant or spec change
that prevents recurrence.

The addressing syntax `§<S>.<n>` lets commands, commits, PRs, and reports refer
to exact spec facts without reloading broad prose. This is the key architectural
lesson for UTK: compact summaries should be addressable handles into exact
artifacts, not free-floating paraphrases.

### v4 Command Flow

`/ck:spec` is the sole general mutator. It either creates a new spec, distills
one from code, records a bug, or amends a named section. It refuses to silently
rewrite unnamed sections.

`/ck:build` implements tasks against the spec. It plans with explicit invariant
and interface citations, names tests, flips only task status cells, and treats
test/build failure as a backprop decision point rather than a blind retry.

`/ck:check` is read-only. It reports drift with file/line evidence and gives
remedy hints, but does not invoke fixes. This separation of diagnostic and
mutating workflows is worth copying for UTK: route/schema health checks should
not mutate `.utk/` unless a separate init/backprop skill is invoked.

### Backprop Protocol

The `backprop` skill is Cavekit's strongest reusable idea. Its six steps are:

1. trace root cause to exact behavior and file/line;
2. analyze whether the spec, interface, or task was wrong/incomplete;
3. propose a `§B` row and usually a new `§V`;
4. generate a test for the invariant;
5. verify fix and full suite;
6. commit spec, test, and code together.

For UTK, the analog is compression/routing backprop:

- bad compact output leaks raw payload → add invariant and regression fixture;
- required fact not recoverable → add fact-retention rule and fixture;
- TOON/compressed JSON drift → add provider validation case;
- non-shell tool mishandled → add schema/route fixture and artifact recovery test.

### v3 Autonomous Runtime

The frozen v3.1.0 tag had a much larger runtime. A Node workhorse
`scripts/cavekit-tools.cjs` owned `.cavekit/` state, config, locks, heartbeats,
task registration, completion, budget tracking, status blocks, discovery, and
loop setup/teardown. Claude hooks then drove the loop through Stop, PreToolUse,
and PostToolUse events.

This is not the current Cavekit direction, but it is a valuable record of what
the author cut for token efficiency. The removal list is instructive: if a
system needs hooks, state machines, dashboards, subagents, reviews, worktrees,
and CLIs, each part must earn its context and maintenance cost.

### v3 Hook Patterns

The v3 hook file was Claude-specific, not GitHub Copilot hook schema. It wired:

- Stop → `stop-hook.sh` to keep the autonomous loop moving;
- PreToolUse on Bash/Grep/Glob/Read → `tool-cache.js`;
- PostToolUse → token monitor, test-output filter, auto-backprop, cache store,
  and progress tracker.

Two patterns are particularly relevant:

- Read-only tool cache: cache safe reads, deny repeat execution, inject cached
  result. UTK can copy the idea only with strict mutation detection and artifact
  provenance.
- Test-output filter: detect test commands, keep failure context, elide noisy
  middle lines, and return condensed context. UTK should do this with raw
  artifact persistence and schema-backed failure summaries.

### v3 Team And Worktree Model

v3 could run inline or in worktree-isolated subagents. Worktree mode claimed
tasks, started heartbeats, dispatched task-builder agents, merged packet
branches, and released claims. Team mode kept claims and ledger state outside
the feature branch so coordination state did not pollute diffs.

This is useful future research for UTK dynamic session-agents/session-skills,
but not a near-term target. UTK's first responsibility remains compact,
recoverable tool mediation, not parallel project execution.

## Competitive Implications For UTK

Cavekit does not compete directly with UTK on tool payload mediation. It
competes for the broader claim that token optimization should be structural,
not just a summarizer. Cavekit's answer is "make the spec compact and durable."
UTK's answer is "make tool IO compact, typed, recoverable, and measurable."

Where Cavekit is strong:

- compact durable project memory;
- strict addressable spec sections;
- failure-to-invariant backprop;
- tiny current command surface;
- explicit removal of token-expensive orchestration;
- practical old patterns for tool caching and test output condensation.

Where UTK can stay stronger:

- shell and non-shell Copilot tool-call mediation;
- raw artifact persistence with compact handles;
- schema inference and route confidence;
- official TOON and compressed JSON serialization providers;
- RTK parity metrics with fact retention and recoverability;
- GitHub Copilot hook/plugin marketplace packaging;
- no public CLI and no broad build-orchestration runtime.

## Competitive Opportunities For UTK

1. Add UTK "backprop" terminology to internal docs/tests: every compression
   failure should become a durable invariant plus fixture.
2. Make `.utk/` summaries addressable like Cavekit's `§` sections: schemas,
   routes, artifacts, facts, failures, and serializer decisions should have
   stable IDs.
3. Add test-output-specific route templates for `vitest`, `tsc`, `pytest`,
   `go test`, and similar commands, using Cavekit's failure-window approach but
   preserving full raw output artifacts.
4. Consider safe read-only tool caching as a future feature, but only after
   mutation detection, TTL, raw artifact identity, and invalidation rules are
   tested.
5. Keep UTK's install/runtime surface aggressively small. Cavekit v4 is a good
   warning that orchestration frameworks can cost more tokens than they save.
6. Use pipe-table/caveman summaries only for human-readable reports. Machine
   payloads should stay official TOON or compressed JSON with validation.
7. Extend `utk-init` to generate invariant-like checks from registered tool
   schemas: protected fields, required facts, recovery paths, and serializer
   expectations.
8. Add a read-only `.utk` drift/check skill that reports schema-route/artifact
   violations without mutating state.
9. Preserve Cavekit's separation between mutating and diagnostic workflows:
   init/backprop can write; check/report cannot.
10. Document known complexity cuts clearly, so UTK does not accidentally become
    a public CLI, MCP-first runtime, or project orchestration framework.

## Risks And Non-Goals

- Do not copy Cavekit v3's public CLI/TUI, tmux, worktree manager, or team
  runtime into UTK.
- Do not treat `SPEC.md` as a replacement for `.utk/` raw artifacts. Specs are
  intent; UTK artifacts are evidence.
- Do not use caveman-style prose compression on code, patches, commands, paths,
  identifiers, errors, JSON keys, or exact facts.
- Do not add a hidden autonomous loop. UTK should mediate tool calls and expose
  skills/hooks explicitly.
- Do not confuse Claude hook schemas from Cavekit v3 with GitHub Copilot hook
  schemas.

## Source Files Reviewed

Current v4:

- `README.md`
- `FORMAT.md`
- `CHANGELOG.md`
- `UPGRADE.md`
- `plugin.json`
- `commands/spec.md`
- `commands/build.md`
- `commands/check.md`
- `skills/spec/SKILL.md`
- `skills/build/SKILL.md`
- `skills/check/SKILL.md`
- `skills/backprop/SKILL.md`
- `skills/caveman/SKILL.md`

Frozen v3.1.0:

- `README.md`
- `plugin.json`
- `hooks/hooks.json`
- `hooks/tool-cache.js`
- `hooks/tool-cache-store.js`
- `hooks/test-output-filter.js`
- `hooks/auto-backprop.js`
- `hooks/token-monitor.sh`
- `hooks/progress-tracker.js`
- `hooks/stop-hook.sh`
- `scripts/cavekit-tools.cjs`
- `scripts/cavekit-router.cjs`
- `scripts/setup-build.sh`
- `commands/make.md`
- `commands/review.md`
- `cmd/cavekit/main.go`
- `internal/session/*`
- `internal/team/*`
- `internal/tmux/*`
- `internal/tui/*`
- `internal/worktree/*`
- `agents/*.md`
- `skills/*/SKILL.md`
