---
type: paper
title: Anka Competitive Research
description: Research dossier on Anka, an adaptive-tokenization / vocab-surgery approach to token reduction (arXiv 2512.23214).
tags: [research, internal]
timestamp: 2026-07-02T00:00:00Z
---
# Anka Competitive Research

Internal note. Do not link this document from the public README unless the
competitive strategy becomes intentionally public.

Research date: 2026-07-02
Primary paper: https://arxiv.org/abs/2512.23214
Paper HTML: https://arxiv.org/html/2512.23214v1
Official repository: https://github.com/BleBlo/Anka
Observed official repository revision: `540128d90b74c125eb5881f7bb42246d2e89bc7e`
(2026-02-26, "Anka: LLM-optimized DSL for data transformation pipelines";
shallow clone, so commit count not observed)
Observed arXiv version: v1, submitted 2025-12-29, cs.CL (+ cs.LG, cs.PL,
cs.SE), ACM classes D.3.2; I.2.7, "11 pages, 1 figure, 4 tables"
Author: Saif Khalfan Saif Al Mazrouei (University of Wisconsin-Madison)
DOI: `10.48550/arXiv.2512.23214`
License: MIT ("Ankah Contributors", 2024)

## Citation Ledger

Use this ledger when re-checking or citing claims. Source labels are used
throughout this note.

| ID | Source | Evidence captured |
|---|---|---|
| ANKA-ARXIV | arXiv abstract page, `arXiv:2512.23214` | Title, author, v1 date, subjects, ACM classes, DOI, abstract claims: 99.9% parse success, 95.8% overall accuracy, +40pp multi-step vs Python, +26.7pp GPT-4o-mini confirmation. |
| ANKA-PAPER | arXiv HTML full text, `2512.23214v1` | Design principles, syntax, 18 operations, implementation claims, benchmark design (Table 2), evaluation protocol, metrics, result Tables 3–4, error analysis percentages, complexity analysis, limitations. |
| ANKA-GITHUB | Official repository README at observed revision | Headline results tables, feature list, quick start, benchmark commands, citation placeholder, project statistics block. |
| ANKA-CODE | Local shallow clone of official repo at `540128d...` | Grammar/AST/test/LOC counts, benchmark task inventory, prompt file sizes, `benchmarks/config.yaml` sampling values, `METHODOLOGY.md`, `FINAL_REPORT.md`, MIT license text. |

## Canonical Citation

The repository README's BibTeX block is a placeholder at research time
(`author={[Your Name]}`, `arXiv:2025.XXXXX`). Cite via arXiv metadata
instead:

- arXiv: `arXiv:2512.23214 [cs.CL]`, v1, submitted 2025-12-29.
- DOI: `10.48550/arXiv.2512.23214`.

## Install And Configuration Status

Anka was researched from the arXiv abstract page, the arXiv HTML full text,
and a temporary shallow clone of the official repository. It was not
installed, run, or benchmarked in this UTK workspace.

Documented upstream usage from the official README:

```bash
pip install -e .
python -m anka examples/hello.anka
python -m anka --repl

# Benchmarks
python -m benchmarks.runner --provider anthropic \
  --model claude-3-5-haiku-20241022 --samples 3
```

Important caveats:

- Anka is **not a token compressor**. It is a reliability play: a constrained
  DSL that reduces LLM generation *errors* on multi-step data pipelines. Its
  fourth design principle (verbose keywords) deliberately spends more tokens
  per operation than Python/pandas would.
- Every session pays a prompt tax: the model learns Anka entirely in-context
  from a syntax guide (paper says ~100 lines; the repo's `anka_prompt.md` is
  500 lines plus a 208-line few-shot file).
- The repo is a single-author research artifact: it contains the author's
  resume `.docx` files and ACL paper sources alongside the implementation,
  and its internal `METHODOLOGY.md` describes an earlier protocol that
  disagrees with the paper in several places (see discrepancies below).
- MIT licensed; concepts and even code are safe to study, but UTK should not
  adopt a bespoke DSL surface.

## Core Positioning

Anka is a domain-specific language for data transformation pipelines designed
for LLM generation rather than human ergonomics. The hypothesis: LLM errors on
multi-step code stem from general-purpose language *flexibility*, so removing
choices improves accuracy. Four design principles:

1. **One canonical form** per operation (`FILTER source WHERE cond INTO
   target` is the only filter syntax; a 5-step pipeline with 3 choice points
   per step collapses from 3⁵ = 243 possible programs to 1).
2. **Named intermediate results** — every operation must name its output via
   `INTO`, eliminating variable shadowing.
3. **Explicit step structure** — named `STEP` blocks scaffold sequential
   generation.
4. **Verbose keywords** — `FILTER`, `MAP`, `AGGREGATE`, `WHERE`, `INTO`
   instead of operators, leveraging LLM natural-language strength.

Typed inputs (`TABLE[field: TYPE, ...]` with INT, STRING, DECIMAL, BOOL,
DATE, DATETIME) plus 18 operations: FILTER/SELECT/DISTINCT (selection),
MAP/RENAME/DROP/ADD_COLUMN (transformation), AGGREGATE with
COUNT/SUM/AVG/MIN/MAX (aggregation), SORT/LIMIT/SKIP/SLICE (ordering),
JOIN/LEFT_JOIN/UNION (combination), READ/WRITE/FETCH/POST (I/O).

This differs from UTK's center:

- Anka optimizes **generation correctness** of new code in a bespoke
  language; token spend goes up, error rate goes down.
- UTK mediates Copilot tool calls, compacts payloads, and preserves raw
  artifacts; token spend goes down with correctness gated at 1.000.

The competitive overlap is real but indirect: in agentic loops, failed
generations are re-tried and re-debugged, so error-rate reduction is itself a
token optimization. Anka also independently validates several UTK design
bets: constrained/canonical formats reduce model errors, explicit named
handles beat implicit state, and structural scaffolding helps multi-step
work — the same reasoning behind TOON serialization, schema routes, and
`[utk-block:<id>]` recovery handles.

## Capability Inventory

| Capability | What it does | How Anka implements it | UTK relevance |
|---|---|---|---|
| Canonical single form | Removes syntactic decision points. | Exactly one syntax per operation, enforced by a Lark grammar (385-line `anka.lark`, ~98–99 production rules). | Supports UTK's one-canonical-serialization stance; fewer valid shapes = fewer model errors when reading or writing UTK payloads. |
| Explicit named intermediates | Prevents variable shadowing / lost state. | Mandatory `INTO <name>` on every operation; paper attributes 42% of Python failures to shadowing. | Direct analogue of UTK artifact ids and route names: every compacted payload gets an explicit handle. |
| Step scaffolding | Prevents ordering errors (31% of Python failures). | Named `STEP` blocks executed sequentially; chaining (27% of failures) is impossible by construction. | Pattern for UTK session-agent plans and multi-step tool workflows: explicit, named, ordered steps. |
| In-context DSL acquisition | New language with zero training data. | ~100-line syntax guide in-prompt (repo file is 500 lines); Claude 3.5 Haiku reaches 99.9% parse success. | Counterpoint to Token Sugar's negative result: verbose English-keyword formats CAN be prompt-taught; dense special-token formats cannot. Keep UTK formats verbose-keyword-ish or grammar-enforced. |
| Typed input schemas | Reduces schema mismatches. | `TABLE[field: TYPE]` declarations doubling as in-prompt documentation. | Mirrors UTK schema inference/routing; validates shipping the schema with the payload reference. |
| Deterministic error recovery | Auto-repairs near-miss generations. | Constrained syntax makes failures predictable: auto-append missing `INTO result_N`, fix `=` → `==`, infer missing source table; recovery intentionally not attempted for Python (ANKA-CODE, `METHODOLOGY.md`). | Strong idea: UTK serializers could deterministically repair near-miss TOON/compact-JSON emissions instead of failing or retrying at full token cost. |
| Interpreter + tooling | Executable, testable DSL. | ~6,400 LOC (observed 6,385 in `src/`), 68 AST node dataclasses, tree-walking interpreter, IF/ELSE, FOR_EACH, WHILE, TRY/ON_ERROR, 322 unit tests (observed 322 test functions), REPL, VS Code extension. | Reference for how much surface a bespoke DSL demands — a cost UTK avoids by using grammar-constrained existing formats. |
| Task-accuracy metric | Robust to sampling noise. | Task counted correct when ≥50% of 10 samples pass; also parse success, execution success, output correctness. | Adopt majority-of-samples task accuracy for UTK evals where generation variance matters. |
| Adversarial task category | Targets known failure modes. | 20 adversarial tasks (multi-condition, null handling, off-by-one, operator confusion) in the 100-task suite. | UTK eval fixtures should similarly include adversarial payloads aimed at known compaction failure modes. |
| Honest complexity scoping | States where it does not help. | No advantage at 1–2 ops; −10pp on "hard" open-ended tasks; recommends use only for 3+ step structured pipelines. | Model for UTK docs: keep publishing where raw output beats compaction. |

## Evaluation Results

### Benchmark Suite (Table 2)

100 data-transformation tasks in 8 categories, each with a natural-language
description, an input schema, and test cases:

| Category | Tasks | Description |
|---|---:|---|
| filter | 10 | Single and compound filtering |
| map | 10 | Column computation |
| aggregate | 10 | Grouping and aggregation |
| strings | 10 | String manipulation |
| multi_step | 10 | 3–5 sequential operations |
| finance | 20 | Domain-specific calculations |
| hard | 10 | Complex logic with edge cases |
| adversarial | 20 | Tasks designed to trigger common errors |

Observed in the repo: `benchmarks/tasks/` holds the first seven categories
(80 task files) and `benchmarks/problems/adversarial/` the 20 adversarial
tasks; an older `benchmarks/problems/` layout (71 JSONs across
filter/limit/map/pipeline/select/sort/adversarial) also remains.

### Protocol (Paper §4.2)

- Identical prompt structure per language: language spec, task description,
  input schema, expected output format.
- Anka prompt teaches the language from scratch; Python prompt assumes
  pandas.
- 10 samples per task per language, temperature 0.3 (but see discrepancies).
- Models: Claude 3.5 Haiku (primary), GPT-4o-mini (cross-validation).
- Primary metric: task accuracy = fraction of tasks where ≥50% of samples
  produce correct output.

### Main Results (Table 3, Claude 3.5 Haiku)

| Category | Anka | Python | Δ (pp) |
|---|---:|---:|---:|
| multi_step | 100.0% | 60.0% | +40.0 |
| finance | 90.0% | 85.0% | +5.0 |
| aggregate | 100.0% | 100.0% | 0.0 |
| filter | 96.7% | 100.0% | −3.3 |
| map | 100.0% | 100.0% | 0.0 |
| strings | 100.0% | 100.0% | 0.0 |
| hard | 90.0% | 100.0% | −10.0 |
| **Overall** | **95.8%** | **91.2%** | **+4.6** |

Parse success: 99.9% for Anka despite zero training exposure (Python 100%).
Note Table 3 lists seven categories plus Overall; the adversarial category
from Table 2 is not broken out.

### Cross-Model Validation (Table 4, multi_step only)

| Model | Anka | Python | Δ (pp) |
|---|---:|---:|---:|
| Claude 3.5 Haiku | 100.0% | 60.0% | +40.0 |
| GPT-4o-mini | 86.7% | 60.0% | +26.7 |

Python multi-step accuracy is identical (60%) across both models, suggesting
systematic rather than model-specific difficulty.

### Failure Analysis And Complexity Scaling

Failing Python generations: variable shadowing 42%, operation sequencing
31%, chaining confusion 27%. Advantage by complexity: 1–2 ops → 0pp; 3–4 ops
→ +5pp; 5+ ops → +40pp.

### Limitations (Paper's Own)

Benchmark limited to data-transformation pipelines; two models only; no
comparison against an Anka-fine-tuned model; no user study; single
self-authored benchmark that "may contain biases that favor Anka." The
repo's `METHODOLOGY.md` goes further: the study "does NOT claim that Anka is
'better' than Python," calling the comparison fundamentally unfair in both
directions (Python has training-data advantage; Anka gets deterministic
error recovery that Python is denied).

## Competitive Implications For UTK

Anka does not compete with UTK on payload compaction — it spends tokens to
buy reliability. It competes on the adjacent claim UTK also makes: that
constrained, canonical, explicitly-named formats make LLM+tool workflows more
reliable. Its results are useful ammunition and useful patterns.

Where Anka is strong:

- clean causal story linking each syntax constraint to a measured error class;
- prompt-taught novel format reaching 99.9% parse success — strong evidence
  for the learnability of UTK's serialized formats and route summaries;
- deterministic auto-recovery of near-miss generations, enabled by the
  constrained grammar;
- adversarial benchmark category and majority-of-samples task accuracy;
- honest scoping (no advantage on simple tasks, negative on open-ended ones).

Where UTK stays stronger:

- token economics: Anka's verbose keywords and per-session syntax guide
  (hundreds of prompt lines) raise token cost; UTK lowers it and gates on
  fact retention;
- no bespoke language adoption: UTK constrains *existing* formats via
  llguidance/schemas rather than asking models (or users) to learn a DSL;
- full mediation surface: raw artifacts, recovery handles, schema routing,
  history compaction — none of which Anka addresses;
- multi-benchmark discipline with checked-in competitor baselines, versus a
  single self-authored suite.

## Competitive Opportunities For UTK

1. Add deterministic near-miss repair to UTK serializer validation: when a
   model emits almost-valid TOON/compact JSON, apply Anka-style predictable
   fixes (missing handle, wrong delimiter) before falling back to re-ask.
   Log repairs as a metric.
2. Enforce Anka's "explicit naming" rule in UTK outputs: every compacted
   span, route, and artifact gets a unique handle; never rely on positional
   or implicit reference. UTK already does this — cite Anka's 42%
   shadowing-failure number as external validation.
3. Use STEP-style scaffolding in generated session-agents/skills for
   multi-step tool plans: named, ordered steps with declared outputs, since
   the measured win concentrates at 3+ sequential operations.
4. Adopt the ≥50%-of-samples task-accuracy metric and an adversarial fixture
   category (nulls, off-by-one, operator confusion, multi-condition) in
   `@utk/evals`.
5. Keep UTK's model-visible formats either (a) verbose-keyword readable or
   (b) grammar-enforced — Anka (prompt-learnable, verbose) and Token Sugar
   (prompt-unlearnable, dense) bracket the design space; dense formats
   require enforcement, not prompting.
6. Quantify the "reliability is token optimization" angle: measure retry and
   debug-loop token spend saved by schema-validated outputs, so UTK can
   answer the Anka-style pitch with numbers on its own axis.
7. Cap format-guide prompt overhead: Anka pays ~500 lines per session to
   teach syntax; UTK session-skills should keep per-session format guidance
   compact and cache-referenced (`.utk/` lexicon ids), not re-taught inline.

## Risks And Non-Goals

- Do not build or adopt a bespoke DSL surface for UTK payloads or tool
  plans; the cost side (interpreter, tests, editor tooling, per-session
  teaching) is exactly what Anka's ~6,400-LOC implementation demonstrates.
- Do not read Anka's +40pp headline as a token-efficiency result; it is an
  accuracy result on a 10-task category of a self-authored benchmark, with
  deterministic recovery granted to Anka but denied to Python.
- Do not cite the paper's numbers without the repo caveats: sampling
  temperature and sample counts differ across the paper (0.3/10), the repo
  config (0.8/10), the final report (3 samples), and the methodology doc
  (0.7/10).
- Do not assume verbose-keyword formats are free: they trade UTK's core
  currency (tokens) for reliability; UTK must win both via grammar
  enforcement rather than verbosity.
- Do not generalize beyond data-transformation pipelines; the author scopes
  the claims there explicitly.

## Source Notes And Discrepancies

- arXiv page: v1 submitted 2025-12-29, cs.CL primary with cs.LG/cs.PL/cs.SE
  cross-lists, ACM D.3.2; I.2.7, DOI `10.48550/arXiv.2512.23214`
  (ANKA-ARXIV).
- Sampling disagreement across surfaces: paper §4.2 says 10 samples at
  temperature 0.3; `benchmarks/config.yaml` says 10 samples at temperature
  0.8; `FINAL_REPORT.md` (2025-12-25) says 3 samples per task;
  `METHODOLOGY.md` says 10 samples at temperature 0.7. Name the surface when
  citing (ANKA-PAPER, ANKA-CODE).
- Prompt-size disagreement: paper says the Anka syntax guide is "approximately
  100 lines"; observed `benchmarks/prompts/anka_prompt.md` is 500 lines plus
  `anka_fewshot.md` at 208 lines (ANKA-CODE).
- Statistics disagreements: paper claims 98 grammar production rules, 68 AST
  node types, ~6,400 LOC, 322 tests; README claims 98 rules, 67 node types,
  ~5,000 LOC, 322 tests; observed: ~99 rule definitions in `anka.lark`, 68
  classes in `src/anka/ast/nodes.py`, 6,385 LOC in `src/`, 322 test
  functions (ANKA-CODE).
- Benchmark inventory: Table 2's 8 categories/100 tasks reconcile with the
  repo as 80 files under `benchmarks/tasks/` plus 20 adversarial JSONs under
  `benchmarks/problems/adversarial/`; an older 71-task layout with different
  category names coexists. Table 3 omits an adversarial row, so whether the
  95.8%/91.2% overall includes adversarial tasks is not stated.
- README BibTeX is a placeholder with a different working title ("Teaching
  LLMs Domain-Specific Languages via Prompt...") and `arXiv:2025.XXXXX`.
- README's headline table lists parse success as Anka 99.9% vs Python 100%;
  the paper presents 99.9% as the achievement for a zero-training language.
- LICENSE is MIT, copyright "2024 Ankah Contributors" (note the "Ankah"
  spelling); README clone URL still points at `yourusername/anka`.
- `METHODOLOGY.md` frames the work as a viability study with four RQs
  (including recoverability and consistency) and explicitly disclaims
  Anka-vs-Python superiority; the paper's framing is stronger. Prefer the
  paper for citable claims, the methodology doc for protocol honesty.

## Source Files Reviewed

Official repository (shallow clone at `540128d...`):

- `README.md`
- `LICENSE`
- `FINAL_REPORT.md`
- `benchmarks/METHODOLOGY.md`
- `benchmarks/config.yaml`
- `benchmarks/prompts/` (file inventory and line counts)
- `benchmarks/tasks/` and `benchmarks/problems/` (task inventories)
- `src/anka/grammar/anka.lark`, `src/anka/ast/nodes.py`, `src/` line counts
- `tests/` (test-function count)
- repository layout including `anka-acl/`, `vscode-anka/`, `examples/`

arXiv:

- Abstract page `arXiv:2512.23214`
- Full HTML text `2512.23214v1` (all sections, Tables 1–4, Figure 1
  description)
