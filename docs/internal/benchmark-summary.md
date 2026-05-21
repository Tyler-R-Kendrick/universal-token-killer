# Benchmark Summary

Aggregate view of fixture-backed benchmark comparisons in this repository.

## Current Results

| Benchmark | Baseline | Scope | Cases | Passed | UTK tokens | Baseline tokens | Saved | Average UTK/baseline ratio | Quality gates | Report |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| RTK parity | RTK shell baselines | Shell plus generalized tool output | 61 | 61/61 | 146 | 563 | 417 | 0.271 | Facts 1.000, autoevals 1.000, recovery 1.000 | [RTK report](rtk-parity-benchmark-results.md) |
| Caveman parity | Caveman terse prose plus lite/full/ultra/wenyan modes | Human-facing technical summaries | 80 full; 320 mode evals | 80/80 full; 320/320 modes | 1,366 full; 5,464 modes | 1,741 full; 7,483 modes | 375 full; 2,019 modes | 0.756 full; 0.736 mode avg | Autoevals 1.000, edge gates 1.000 across all modes | [Caveman report](caveman-parity-benchmark-results.md) |
| Compresr parity | Compresr deterministic SDK baselines | Query-aware compression and context-gateway cases | 39 | 39/39 | 431 | 958 | 527 | 0.452 | Autoevals 1.000, recovery 1.000 | [Compresr report](compresr-parity-benchmark-results.md) |
| LeanCTX Copilot | LeanCTX Copilot context-runtime baseline | Copilot prompt surfaces, tool output, tool schemas | 50 unique; 1,500 evaluated | 1,500/1,500 | 108,750 | 163,980 | 55,230 | 0.663 | Relevance 1.000, correctness 1.000, groundedness 1.000 | [LeanCTX Copilot report](leanctx-copilot-benchmark-results.md) |

## Interpretation

- RTK parity focuses on CLI-shaped output and generalized tool-output serialization.
- RTK token totals include the 29 RTK-supported shell baselines; generalized tool-output scenarios remain covered by the RTK report quality gates.
- Caveman parity focuses on terse human-facing responses where style compression can accidentally drop exact facts; it now runs the same 80 cases across lite, full, ultra, and wenyan mode baselines.
- Compresr parity focuses on remote-compressor-like behavior while keeping deterministic local baselines and raw data local.
- LeanCTX Copilot focuses on Copilot-specific context-runtime behavior, including hooks, recovery, proof-like grounding, and deferred tool discovery.

## Update Rules

- Update this file whenever any benchmark report changes its pass count, scenario count, token ratio, savings, or quality-gate result.
- Keep detailed per-case tables in each benchmark-specific report.
- Keep LeanCTX Copilot details in `docs/internal/leanctx-copilot-benchmark-results.md`, not inline here.
