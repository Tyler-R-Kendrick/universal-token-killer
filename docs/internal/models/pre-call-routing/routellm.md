# RouteLLM Competitive Research

Internal note. Do not link from the public README.

Research date: 2026-07-02
Layer: Pre-call routing
Primary source: arXiv **2406.18665** — *RouteLLM: Learning to Route LLMs with Preference Data*
Repo: [`lm-sys/RouteLLM`](https://github.com/lm-sys/RouteLLM), Apache-2.0, ~5.1k stars
Verification: ✅ claimed ID correct (v1 2024-06-26, latest v4 2025-02-23). Authors
Isaac Ong, Amjad Almahairi, Wei-Lin Chiang, Tianhao Wu, Joseph E. Gonzalez,
M. Waleed Kadous, Ion Stoica et al. (LMSYS / UC Berkeley Sky Computing / Anyscale).
Venue: arXiv preprint (cs.LG) — not published at a conference.

## Positioning

The canonical **learned strong/weak router**. Trains a lightweight router to send
each query to either a strong (expensive) or weak (cheap) model, tuned by a single
threshold that slides along the cost/quality curve.

## Mechanism

Multiple router families are trained on **human preference data** (Chatbot Arena),
optionally augmented: similarity-weighted ranking, matrix factorization, a BERT
classifier, and a causal-LLM classifier. Each predicts whether the weak model will
be "good enough" for a query; the threshold sets how often the strong model is
invoked. The paper demonstrates **transfer**: a router trained on one strong/weak
pair keeps working when the underlying models are swapped at test time.

## Verified Metrics

Quote each with its source surface — the brief conflated two:

- **Abstract:** "reduces costs by **over 2 times** in certain cases" with no
  quality compromise — **no benchmark named in the abstract.**
- **Repo README:** "reduce costs by **up to 85%** while maintaining **95% GPT-4
  performance**" on benchmarks "like **MT Bench**"; routers reach "the same
  performance as commercial offerings while being **>40% cheaper**." Framework also
  evaluates on **MMLU** and **GSM8K**.

All figures are the authors' own evaluations, not independent benchmarks. The
strong/weak headline pair is a GPT-4-class model vs a cheaper open model.

## Scope

**COST-REDUCTION.** Picks a cheaper model per query; does not cut token count.
Actual savings depend heavily on the **price spread** between the two models and
on **router calibration** — a poorly calibrated threshold either over-escalates
(no savings) or under-escalates (quality loss).

## UTK Relevance

The reference implementation for `@utk/model-proxy`'s strong/weak decision. Adopt
the **threshold-as-a-knob** framing and the transfer result (routers survive model
swaps). Constraint: the router is **trained on preference data** → not
training-free, so UTK would either host a pretrained RouteLLM router as an optional
proxy component or replace it with cheap deterministic features (prompt length,
task type, file count) per the master README's "router has a cost" caution.

## Caveats

- Two headline numbers come from **different sources** (abstract vs README) — cite
  the surface explicitly.
- Savings are price-spread- and calibration-dependent; not a fixed guarantee.
- Complementary to UTK compression, not a substitute: route to the cheap model
  *and* compress its prompt.
