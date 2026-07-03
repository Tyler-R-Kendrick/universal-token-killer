# Evals

`@utk/evals` compares token-compaction techniques on a shared benchmark. Every run
executes three concurrent arms over the **same** data through the **same** harness:

- **baseline** — the agent reads the full, uncompacted tool output;
- **competitor** — a configured model of a rival technique (RTK, Compresr, Caveman, …);
- **utk** — UTK persists the raw output off-context and surfaces a recoverable handle.

Each arm is graded on token cost *and* quality, so a technique only "wins" when it
keeps the facts. This mirrors the AgentV
[skill-improvement workflow](https://agentv.dev/docs/guides/skill-improvement-workflow/):
run a baseline, run a candidate, compare, iterate.

## Layout

```
packages/evals/
  data/<benchmark>.jsonl        # benchmark cases (one JSON object per line)
  harness.ts                    # base harness: 3 arms, hooks/middleware, grading
  comparison/<competitor>.ts    # per-competitor config over the shared data
  graders/                      # token (code), relevance (LLM), composite graders
  data/<benchmark>.provenance.json  # provenance manifest (origin + related benchmarks)
  suites/<benchmark>.EVAL.yaml  # formalized AgentV suite, generated from the jsonl
  results/<benchmark>.json      # latest run artifacts (+ summary.json)
  evaluators/ + baselines/      # agentevals.io evaluator protocol + baseline store
```

Registered competitors: **RTK**, **LeanCTX**, **Compresr**, **Caveman**, **Ponytail**
(`comparison/*.ts`). Add one by exporting a `Comparison` and registering it in
`comparison/index.ts`.

## Benchmark data

A case is technique-agnostic — it describes the raw tool output and what a good
compaction must (and must not) preserve. Provider behaviour lives in the comparison
files, never in the data.

```jsonc
{
  "name": "shell-kubectl-pods",
  "category": "Kubernetes",
  "toolId": "shell.kubectl.get-pods",
  "prompt": "Which pod is failing and how many times has it restarted?",
  "rawOutput": "NAME ...\nworker-6c44d9fbdf-9mxrs  0/1  CrashLoopBackOff  7  11m",
  "requiredFacts": ["worker-6c44d9fbdf-9mxrs", "CrashLoopBackOff   7"],
  "irrelevantFacts": ["api-5d9f7d7c9f-q2l8x       1/1     Running            0          2d"]
}
```

- `requiredFacts` must stay **recoverable** after compaction (accuracy / groundedness).
- `irrelevantFacts` are noise that a good compaction should drop from the chat surface (relevance).

## Harness

`runBenchmark(comparisons, options?)` runs baseline, every competitor, and UTK as
sibling arms over the same data, concurrently, and returns them baseline-first / UTK-last
— the leaderboard. `runComparison(comparison, options?)` runs one competitor's
baseline/competitor/UTK triple. Each arm produces an `{ visibleText, recoverableText }`
surface: `visibleText` is the model-visible chat (what tokens are charged against);
`recoverableText` is everything still reachable (chat + stored artifact) and is where fact
retention is checked. Baseline and lossy-in-chat competitors have equal surfaces; UTK keeps
`visibleText` tiny while leaving facts recoverable.

**Hooks / middleware.** The base `SessionConfig` (`tools`, `skills`, `model`, `judge`) applies
to every arm — that is the seam for a global `configureModel` hook that swaps the judge used by
the LLM grader. A comparison's per-provider `middleware` tags only its own arm (e.g. the provider
`skills`), so grading stays uniform across arms while each provider records how it was configured.

## Graders

| Grader | Kind | Scores |
| --- | --- | --- |
| `tokenGrader` | code (deterministic) | model-visible token savings vs the raw baseline |
| `relevanceGrader` | LLM (pluggable judge) | relevance, accuracy, groundedness |
| `compositeGrader` | composite | fact-retention gate + weighted blend of tokens & quality |

The composite grader encodes the repo rule *"token savings do not count if quality
drops"*: losing a required fact zeroes the score regardless of tokens. The LLM grader
takes a pluggable `Judge`; the default `referenceJudge` is deterministic (fact retention
+ noise exclusion) so committed results are reproducible offline. Inject a real model via
the harness `configureModel` hook for semantic grading.

Each grader is also a standalone AgentV `type: script` grader — it reads the
`{ input, expected_output, output }` stdin payload and writes `{ score, assertions, reasoning }`.

## Running

```bash
# Run the benchmark; rewrite results/*.json, suites/*.EVAL.yaml, and docs/internal/benchmark-summary.md
npm run evals --workspace @utk/evals

# Just regenerate the formalized AgentV suite from the jsonl data
npm run evals:suites --workspace @utk/evals

# Unit tests (harness, graders, comparisons, evaluator protocol)
npm test --workspace @utk/evals
```

Results are persisted as artifacts under `packages/evals/results/` (`<benchmark>.json` +
`summary.json`) and rendered as the leaderboard in `docs/internal/benchmark-summary.md`,
regenerated in lockstep by `npm run evals` so the numbers never drift from the data.

## Formalized AgentV suite

`suites/<benchmark>.EVAL.yaml` is the jsonl expressed as a runnable AgentV suite: each
case becomes a test whose assertions call the compiled graders. After building the
package, AgentV can run it directly:

```bash
npm run build --workspace @utk/evals
agentv run packages/evals/suites/tool-output.EVAL.yaml
```

## Provenance

Following AgentV's [benchmark-provenance](https://agentv.dev/docs/guides/benchmark-provenance/)
guidance, `data/<benchmark>.provenance.json` records informational (non-executed) metadata —
origin, license, version, and the known public benchmarks the cases relate to. `generate-suite`
emits it into the suite as suite-level and per-test `metadata`.

The `tool-output` cases are **synthetic and self-authored** — not sampled from, or scored on,
any external benchmark. The following public benchmarks are referenced only as task-category
analogs so readers can anchor the kinds of tool output measured here:

- [Terminal-Bench](https://www.tbench.ai/) (Stanford + Laude Institute) — CLI/terminal agent tasks (our `shell.*` cases).
- [SWE-bench](https://www.swebench.com/) (Princeton NLP) — real-repo tasks; test-runner output and tracebacks.
- [τ-bench](https://github.com/sierra-research/tau-bench) (Sierra Research) — tool-agent-user loops over structured tool results.
- [Berkeley Function-Calling Leaderboard](https://gorilla.cs.berkeley.edu/leaderboard.html) (UC Berkeley) — function/tool-calling.

UTK compaction is an orthogonal context-cost layer; the leaderboard numbers are not submissions to these benchmarks.

## AgentEvals evaluator protocol

The package also ships the [agentevals.io](https://agentevals.io) evaluator JSON protocol
natively for trace-based TDD (`tool_trajectory_avg_score`, `response_match_score`,
`no_parse_failures`, `no_soft_failures`), plus `loadUtkTrace` and a baseline store
(`readBaseline` / `writeBaseline` / `diffScorecards`). These consume the Jaeger + EvalSet
artifacts emitted by UTK tracing (see [tracing](tracing.md)) and drive a baseline-gated
loop; walkthrough in [evals-driven-iteration](evals-driven-iteration.md). Wire shapes and
config keys:

- [refs/agentevals-spec.md](refs/agentevals-spec.md)
- [refs/evaluator-config.md](refs/evaluator-config.md)
- [refs/baseline-store.md](refs/baseline-store.md)
- [refs/tracing-failure-codes.md](refs/tracing-failure-codes.md)

## Related benchmarks

The LeanCTX Copilot context-runtime benchmark lives in `scripts/bench-leanctx-copilot.ts`
(tested by `scripts/bench-leanctx-copilot.test.ts`) with results in
`docs/internal/leanctx-copilot-benchmark-results.md`.
