---
type: reference
title: Benchmark Integrity And Limitations
description: "What the UTK benchmarks actually measure, which results hold by construction rather than by measurement, which comparisons are like-for-like, and what models are (not) used."
tags: [evals, benchmark, integrity, methodology, limitations]
timestamp: 2026-07-04T00:00:00Z
---

# Benchmark integrity and limitations

This page is the single honest answer to "what do UTK's benchmark numbers mean?". Every quantitative claim in this repo should be read through it. It exists because the headline tables are easy to over-read: they are **reproducible internal self-comparisons produced entirely by deterministic code**, and several of their most flattering properties hold *by construction*, not by measurement.

## Models used

**None.** No LLM — local or hosted — is invoked anywhere in producing any committed benchmark number in this repository.

- The `model` recorded in results (`reference-model`) is **not a language model**. It is a constants table (`packages/evals/model.ts`) of reference prices ($3/M input, $15/M output tokens), latencies (0.05 ms/token prefill, 8 ms/token decode, 700 ms/tool call), and a $0.0002 per-tool-call fee, used to convert token counts into *modeled* cost and latency.
- "Fact retention" (formerly labeled "task success") is `String.includes` over required substrings, computed by deterministic TypeScript. No model ever answers a question, selects a tool, or executes a workflow step.
- The quality "judge" is the deterministic `referenceJudge` (substring bookkeeping). The graders accept a pluggable `Judge` so a real LLM judge *could* be passed in by a caller, but nothing in this repo constructs one, and **every committed result used the deterministic judge**.
- Token counts are a coarse `ceil(len/4)` character estimate, not a tokenizer.

If a future run ever uses a real model (as a judge, or as a live arm), that run's report must name the exact model id, provider, and date, and must not be mixed into tables produced by the deterministic pipeline.

## Results that hold by construction

- **The UTK arm's 100% fact retention is guaranteed by the setup, on every benchmark.** The arm (`utkTechnique` in `packages/evals/harness.ts`) declares the full raw output "recoverable", and required facts are *defined* as substrings of the raw output — so retention can never be below 100%. The UTK rows therefore measure the modeled **price** of the handle-plus-recovery strategy (visible handle + recovery round-trip + recovered slice), not whether UTK's shipped implementation retains facts.
- **The UTK arm is not the shipped product.** It is a configured model of UTK's strategy — a handle string plus a recoverability declaration. The `@utk/core` mediation pipeline, schema routing, and serializers are not exercised by the leaderboard arms.
- **Competitor arms are not the competitors.** All five (RTK, LeanCTX, Compresr, Caveman, Ponytail) share one extractive line-filter algorithm (`packages/evals/comparison/compactors.ts`), differing only in keep-threshold and query-awareness. They are aggressiveness reference points wearing vendor-inspired names; the vendors' live systems are never installed or run. Do not quote any competitor's cell as that product's performance.
- **The LeanCTX fixture suite's quality scores are 1.000 by construction.** The fixtures (`packages/evals/fixtures/leanCtxCopilotFixtures.ts`) plant required facts as cleanly separable lines, and the UTK surfaces rendered by `scripts/bench-leanctx-copilot.ts` echo the fixtures' required facts back into the graded text. The "LeanCTX baseline" in that suite is a reference rendering **authored in this repo** — its token count (and therefore the 33.68% savings figure) is a property of how verbose we chose to write that template, not of the lean-ctx product. Treat the suite as a regression harness over UTK's Copilot code paths only.

## Comparisons that are (and are not) like-for-like

- The five benchmarks differ in **data shape**, not in exercised capability: all of them score verbatim-substring retention under compaction. "Tool selection" never selects a tool; "agent workflows" contains the pre-written root cause and fix inside the raw output; "needle-in-a-haystack" haystacks are ~300 tokens of one repeated filler line, far below real long-context regimes. The public benchmarks named in provenance files (BFCL, τ-bench, SWE-bench Verified, LongBench, RULER) are *task-category analogs* only — no data, harness, or score is drawn from them.
- **Caveman and Ponytail are assistant-prose / terse-register techniques.** Their tool-selection and needle cells show a prose compressor being misapplied outside its lane (hence 10–40% retention); read them as stress references, not as those techniques' performance on their intended workload. The like-for-like frame per column is: tool-output compaction vs tool-output compaction (RTK, UTK, extractors), query-aware context extraction vs same (LeanCTX/Compresr arms), prose register vs prose register (Caveman/Ponytail on tool-output/long-context only).
- Within a benchmark, arms are internally comparable: same cases, same scorer, same cost model.

## Accounting rules that keep the numbers honest

- **Recovery is charged, in tokens and in tool calls.** An arm whose facts are only *recoverable* (not visible) pays one tool round-trip plus the tokens of the minimal recovered slice — the raw-output lines containing the required facts. This is an **optimistic lower bound** (a real recovery tool may return the whole artifact); before 2026-07-04 recovery tokens were not charged at all, which inflated UTK's token-reduction and frontier results (e.g. tool-output −75% → −53% after the fix, and UTK now fails its own cost-per-success gate on tool-output and tool-selection).
- **Token reduction counts everything the model would see**: compacted context + tool-schema tokens + recovered-slice tokens, against the baseline's raw retrieved tokens.
- **The regression gate is real and UTK is allowed to fail it.** Committed results show UTK failing the cost-per-success gate on tool-output and tool-selection. Tests must never assert that UTK beats competitors (`packages/evals/harness.test.ts` deliberately checks structure, not outcomes).
- The suite timestamp in generated reports is a pinned **data-version stamp**, not a run time; the pipeline is deterministic, so reruns reproduce committed artifacts byte-for-byte (verify with `npm run evals --workspace @utk/evals && git status`).

## Known gaps

- `scripts/verify-no-special-cases.ts` only matches five literal English phrases in a string passed to it and is not wired into CI — it does **not** detect benchmark-specific special-casing in product code. Do not cite it as an integrity guarantee.
- The AgentV script graders trust the arm's self-reported `recoverable` surface; nothing validates that a claimed-recoverable payload is actually recoverable. The harness arms are honest about this only because they are code we wrote.
- The `unsafeTools` safety axis is scored by the harness but not yet by the standalone AgentV script graders (the field is now carried through `expected_output` for future use).
- Real-dataset adapters (`UTK_REAL_DATA_DIR`) and a pluggable cost model/judge exist as seams, but **no committed number was produced through them**.

## What a credible external claim would require

Before quoting any number here against a named competitor or public benchmark: run the vendor's actual system on the same cases, use a real tokenizer, use a real model (named, dated) for task completion and judging, and use measured — not modeled — cost and latency. Until then, the only defensible public phrasing is: *"in UTK's internal deterministic self-comparison, the modeled UTK strategy…"*.
