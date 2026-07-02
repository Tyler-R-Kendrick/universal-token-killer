# Full Ensembling

Internal note. Do not link from the public README.

Research date: 2026-07-02

**Layer definition:** run **multiple** models (and often a ranker and/or fusion
model) per query to **maximize quality**. This is **quality amplification, not token
optimization** — LLM-Blender and MoA strictly **increase** tokens/compute vs a
single call. Track these as competitors' *quality* plays; they become cost/token
relevant only when **gated** to hard cases where the expected retry/escalation cost
exceeds the ensemble cost.

**Scope:** TOKEN/COST-INCREASING (quality technique). The one partial exception is
**Self-MoA**, whose whole thesis is that you do **not** need to run multiple
different models — which removes multi-model hosting overhead.

| Technique | Primary source | Verified | Role | Cost/token direction |
|---|---|---|---|---|
| [LLM-Blender](llm-blender.md) | arXiv 2306.02561 (ACL 2023) | ✅ ID correct | Rank-then-fuse ensemble (PairRanker + GenFuser) | Increases (N models + ranker + fusion) |
| [Mixture-of-Agents](mixture-of-agents.md) | arXiv 2406.04692 | ✅ ID correct | Layered multi-agent aggregation | Increases (each layer re-consumes all prior outputs) |
| [Self-MoA](self-moa.md) | arXiv 2502.00674 | ✅ ID correct (title was truncated in brief) | Skeptical control: single-model aggregation | Increases vs 1 call, but removes multi-**model** overhead |

**UTK read:** **reference-only.** These are the "ensemble everything" end of the
spectrum that the master README warns against as a default. Self-MoA is the most
useful to UTK because it is the **skeptical control** — evidence that heterogeneous
mixing often is *not* worth its cost, which supports UTK's "gate ensembling, don't
default it" stance. Every metric below is an **author self-report** on the named
benchmark; no independent third-party benchmark was found on the primary pages.
