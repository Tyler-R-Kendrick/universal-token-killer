---
type: benchmark
title: Benchmark Summary
description: Aggregate view of fixture-backed benchmark comparisons in this repository.
tags: [evals, benchmark, internal]
timestamp: 2026-07-03T00:00:00Z
---
# Benchmark Summary

Aggregate view of fixture-backed benchmark comparisons in this repository.

These are self-authored parity fixtures measured against deterministic baselines checked into this repo — the competitors are not installed, hosted, or run — with coarse `ceil(len/4)` token estimates. Treat the numbers as reproducible internal self-comparisons that also gate fact retention, recoverability, and correctness, not as head-to-head results against live competitor systems.

## Current Results

| Benchmark | Baseline | Scope | Cases | Passed | UTK tokens | Baseline tokens | Saved | Average UTK/baseline ratio | Quality gates | Report |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| RTK parity | RTK shell baselines | Shell plus generalized tool output | 61 | 61/61 | 146 | 563 | 417 | 0.271 | Facts 1.000, autoevals 1.000, recovery 1.000 | [RTK report](/features/evals/rtk-parity-benchmark.md) |
| Caveman parity | Independent caveman terse prose plus lite/full/ultra/wenyan modes | Human-facing technical summaries | 80 full; 320 mode evals | 80/80 full; 320/320 modes | 1,366 full; 5,464 modes | 1,770 full; 8,622 modes | 404 full; 3,158 modes | 0.742 full; 0.642 mode avg | Autoevals 1.000, edge gates 1.000 across all modes | [Caveman report](/competition/caveman/parity-benchmark.md) |
| Compresr parity | Compresr deterministic SDK baselines | Query-aware compression and context-gateway cases | 39 | 39/39 | 431 | 958 | 527 | 0.452 | Autoevals 1.000, recovery 1.000 | [Compresr report](/competition/compresr/parity-benchmark.md) |
| LeanCTX Copilot | LeanCTX Copilot context-runtime baseline | Copilot prompt surfaces, tool output, tool schemas | 50 unique; 1,500 evaluated | 1,500/1,500 | 108,750 | 163,980 | 55,230 | 0.663 | Relevance 1.000, correctness 1.000, groundedness 1.000 | [LeanCTX Copilot report](/competition/lean-ctx/parity-benchmark.md) |
| Ponytail parity | Independent ponytail lazy-dev code arms plus lite/full/ultra modes | Grammar-grounded min emission for code-authoring tasks | 6 full; 18 mode evals; 6 ladder | 6/6 full; 18/18 modes; 6/6 ladder | 615 full; 1,845 modes | 756 full; 2,372 modes | 141 full; 527 modes | 0.811 full; 0.781 mode avg | Round-trip fidelity, parse validity, min leakage, facts, ladder all 1.000 | [Ponytail report](/competition/ponytail/parity-benchmark.md) |

## Interpretation

- RTK parity focuses on CLI-shaped output and generalized tool-output serialization.
- RTK token totals include the 29 RTK-supported shell baselines; generalized tool-output scenarios remain covered by the RTK report quality gates.
- Caveman parity focuses on terse human-facing responses where style compression can accidentally drop exact facts; it now runs the same 80 cases across independent lite, full, ultra, and wenyan competitor baselines.
- Compresr parity focuses on remote-compressor-like behavior while keeping deterministic local baselines and raw data local.
- LeanCTX Copilot focuses on Copilot-specific context-runtime behavior, including hooks, recovery, proof-like grounding, and deferred tool discovery.
- Ponytail parity focuses on the code-authoring axis: the UTK arm is a grammar-grounded min emission (measured including its @minmap patch overhead) that must expand deterministically to the committed pretty form, and the ladder suite checks the formalized YAGNI→reuse→stdlib→platform→dependency→macro→MVP decisions.

## Update Rules

- Update this file whenever any benchmark report changes its pass count, scenario count, token ratio, savings, or quality-gate result.
- Keep detailed per-case tables in each benchmark-specific report.
- Keep LeanCTX Copilot details in `docs/competition/lean-ctx/parity-benchmark.md`, not inline here.
