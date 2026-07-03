---
type: category
title: "Compound Models & Productized Routers"
description: Shipped products that route or coordinate multiple models behind one endpoint; concrete dossiers live under competition/.
tags: [techniques, model-routing, internal]
timestamp: 2026-07-02T00:00:00Z
---
# Compound Models & Productized Routers

Internal note. Do not link from the public README.

Research date: 2026-07-02

**Layer definition:** shipped *products* (not research papers) that put model
selection or multi-model coordination behind **one OpenAI-compatible endpoint**.
This is the productized, buy-don't-build counterpart to the research in
[`../pre-call-routing/`](/techniques/model-routing/pre-call-routing/overview.md) and
[`../selective-ensembling/`](/techniques/model-routing/selective-ensembling/overview.md). All are verified against
vendor docs/sites; every metric is a **vendor claim** unless a named independent
benchmark is cited.

| Product | Source | Kind | Scope | Metrics |
|---|---|---|---|---|
| [Sakana Fugu / Fugu Ultra](/competition/sakana/products/fugu/research.md) | sakana.ai/fugu | Trained compound orchestrator | COMPOUND-ORCHESTRATION | Vendor benchmark table (Sakana's own) |
| [OpenRouter Auto](/competition/openrouter/products/auto-router/research.md) | openrouter.ai docs | Per-prompt router (NotDiamond) | COST-REDUCTION | None published |
| [OpenRouter Pareto Code](/competition/openrouter/products/pareto-code-router/research.md) | openrouter.ai docs | Coding-score-tiered router | COST-REDUCTION | None published |
| [OpenRouter Fusion](/competition/openrouter/products/fusion/research.md) | openrouter.ai docs | Panel + judge deliberation | SELECTIVE-ENSEMBLE (≈4–5× cost) | None published |
| [NotDiamond](/competition/notdiamond/research.md) | notdiamond.ai | Learned router (powers Auto) | COST-REDUCTION | Vendor/case-study only |

**UTK read:** these are the **buy-side benchmarks** for `@utk/model-proxy`. The most
directly relevant is **OpenRouter Pareto Code** — a coding-quality-tier control is a
better knob for a code agent than generic "smart/cheap," and it's the productized
version of the phase-routing table in the [model-routing overview](/techniques/model-routing/overview.md). **Fugu** is
the ambitious end (a *trained* orchestrator that assembles/verifies/synthesizes an
agent pool internally) — track it as "multi-agent system as a model," but note every
Fugu number is Sakana's own. **Fusion** is a cost *multiplier*, not a saver — a
quality mode to gate, never a default. None of these reduce token count; they
optimize model choice (or, for Fusion, spend more for consensus). All compose with
UTK compression: route with one of these *and* compress the chosen model's prompt.
