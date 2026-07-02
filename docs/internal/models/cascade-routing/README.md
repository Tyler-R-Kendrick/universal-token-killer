# Cascade Routing

Internal note. Do not link from the public README.

Research date: 2026-07-02

**Layer definition:** try the **cheap model first**; escalate to a stronger/pricier
model only when a **quality/confidence estimator** says the cheap answer is not
good enough. Unlike pre-call routing (one-shot choice), a cascade can run several
models in sequence and stop early. The **quality estimator is the critical
component** across all three papers — when it is noisy, the advantage collapses.

**Scope:** all three are **COST-REDUCTION** (dollar-per-query under a budget), not
token compression. All three verified against primary sources; **C3PO — flagged in
the brief as possibly hallucinated — is a genuine NeurIPS 2025 paper.**

| Technique | Primary source | Verified | Novel angle | Cleanly quotable headline |
|---|---|---|---|---|
| [FrugalGPT](frugalgpt.md) | arXiv 2305.05176 (TMLR 2024) | ✅ ID correct | Prompt adaptation + approximation + cascade | "up to 98% cost cut matching best LLM" (best-case, cross-dataset) |
| [Cascade Routing](cascade-routing.md) | arXiv 2410.10347 (ICML 2025) | ✅ ID correct | Unifies routing + cascading, provably optimal | Abstract qualitative ("large margin"); coding evals in body |
| [C3PO](c3po.md) | arXiv 2511.07396 (NeurIPS 2025) | ✅ **real, not hallucinated** | Conformal **probabilistic cost-budget** bound | MATH-500: 62.5% @ $0.0019/q vs SC 57% @ $0.0053/q |

**UTK read:** the cascade pattern (`cheap → verifier → escalate`) is exactly the
`@utk/model-proxy` model-selection loop, and it maps onto the coding-agent
phase-routing table in the [master README](../README.md). The universal caution
applies hard here: a cascade **double-pays on failures** unless it has a cheap,
early rejection signal (compile check, static analysis, small verifier) — which is
precisely the "quality estimator" these papers say is decisive.
