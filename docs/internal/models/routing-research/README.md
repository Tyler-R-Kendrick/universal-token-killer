# Routing Research (second-generation)

Internal note. Do not link from the public README.

Research date: 2026-07-02

**Layer definition:** newer routing research on the **failure modes and controls**
that first-generation routers ([`../pre-call-routing/`](../pre-call-routing/)) miss —
budget-ceiling enforcement under non-stationarity, **routing collapse** (systematic
small-model under-use), router **evaluation**, and joint **model + output-length**
routing. These are the traps and extra levers once you *have* a router.

**Verification note:** the brief gave **no arXiv ID** for EquiRouter or RouteJudge —
both are nonetheless **real** (LAMDA / Nanjing University group). All four verified.

| Technique | Primary source | Verified | Angle |
|---|---|---|---|
| [ParetoBandit](paretobandit.md) | arXiv 2604.00136 | ✅ ID correct | Per-request $ ceiling + non-stationary adaptation |
| [EquiRouter](equirouter.md) | arXiv 2602.03478 | ✅ **real (no ID in brief)** | Fixes "routing collapse" (restore small-model use) |
| [RouteJudge](routejudge.md) | arXiv 2606.18774 | ✅ **real (no ID in brief)** | Preference-aware router *evaluation* platform |
| [R2-Router](r2-router.md) | arXiv 2602.02823 | ✅ ID correct | Joint model **+ output-length budget** |

**UTK read:** these define the maturity checklist for `@utk/model-proxy`'s router.
**EquiRouter's "routing collapse"** is the sharpest warning — a naive budget knob
drifts toward the expensive model, erasing savings (the empirical form of the master
README's "router has a cost"). **R2-Router** adds the most useful lever for coding
agents: a *short strong-model answer can beat a long weak-model answer at the same
cost*, so route model **and** output length together. **ParetoBandit** is the
hard-cost-ceiling mechanism (cf. C3PO's conformal budget in cascades). **RouteJudge**
is the reminder that router quality itself needs measurement. Every metric here is on
the authors' **own** benchmarks — treat as directional.
