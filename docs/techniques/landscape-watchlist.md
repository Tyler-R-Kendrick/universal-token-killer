---
type: survey
title: Token-Optimization Landscape Watchlist
description: Breadth-first survey of 40+ token-optimization techniques with an adopt/borrow/reference-only ranking for UTK.
tags: [techniques, survey, internal]
timestamp: 2026-07-02T00:00:00Z
---
# Token-Optimization Landscape Watchlist

Internal note. Do not link this document from the public README unless the
competitive strategy becomes intentionally public.

Research date: 2026-07-02

See also: [`optimization-competitor-gap-analysis.md`](/gaps.md)
maps UTK's *implemented* optimizations against this landscape and tracks the gaps
that remain open.

This is a **breadth-first watchlist**, not a deep single-technique dossier like
`tokensugar-competitive-research.md` or `anka-competitive-research.md`. It maps
the broader token-optimization landscape across the axes that matter more to
UTK than generic prompt compression: context selection, tool/schema reduction,
reasoning-token control, edit/patch formats, structured-data notation, latent
compression, RAG-time compression, KV/cache runtime optimization, adaptive
tokenization, multimodal pruning, provider/semantic caching, and local-model
routing. Each entry is here to be tracked, not endorsed.

**See also:** the sink-based map in
[`token-optimization-taxonomy.md`](/techniques/overview.md) (which lever for
which sink), the model-level deep dives in [`models/`](/research/model-routing/overview.md), input
compression in [`prompt-compression/`](/research/prompt-compression/overview.md), and
output/skill compression in
[`assistant-prose-compression/`](/techniques/assistant-prose-compression/overview.md).

Every technique below was checked against a primary source (arXiv abstract/HTML
or an official repo/vendor doc). Numbers are quoted with the benchmark they came
from. All source-brief names are now pinned to a primary source; a few are
**verified but differently scoped** than the brief implied (notably MATT and the
KV-cache methods, which are not billable prompt-token reduction) — see
[Verification Status](#verification-status) for those corrections.

## How UTK Should Read This

UTK's center is **hook-first, training-free mediation of Copilot tool calls**
with recoverable `.utk/` artifacts. That constraint sorts the landscape:

- **Directly on-axis (adopt/borrow):** code-agent context pruning, tool/schema
  reduction, structured-data notation, patch/edit formats, RAG-time compression,
  provider/semantic caching, local routing. These operate on payloads/prompts at
  inference time without retraining the frontier model — the same envelope UTK
  lives in.
- **Adjacent (borrow ideas, keep training-free):** reasoning-token control and
  early stopping (relevant to UTK session-agents and `reason-with-lexicon`, but
  most methods here need RL/SFT), soft/latent compression (needs training or a
  learned bridge), adaptive tokenization (needs PEFT + vocab changes).
- **Serving-side only (reference, not billable-token wins):** KV-cache
  compression/quantization and multimodal visual-token pruning matter for
  self-hosted `@utk/model-proxy` latency/concurrency, not for Copilot API
  billable tokens.

The recurring lesson across the whole landscape, and the one UTK already
encodes: **savings must be gated on correctness/recoverability**, because
several of these techniques (TOON in multi-turn loops, aggressive KV eviction,
dense special-token shorthand) trade tokens for accuracy when pushed too far.

## Source Ledger

Primary sources verified on the research date. Use these when re-checking or
citing; do not cite a number without its benchmark.

| Technique | Primary source | Repo / venue |
|---|---|---|
| SWE-Pruner | arXiv 2601.16746 | HF `ayanami-kitasan/code-pruner` |
| SpecAgent | arXiv 2510.17925 | — |
| RepoGraph | arXiv 2410.14684 | `ozyyshr/RepoGraph`; ICLR 2025 |
| Aider repo-map | aider.chat/docs/repomap.html, 2023/10/22/repomap.html | Apache-2.0 (aider) |
| RAG-MCP | arXiv 2505.03275 | — |
| Semantic Tool Discovery (vector MCP) | arXiv 2603.20313 | — |
| TSCG | arXiv 2605.04107 | `SKZL-AI/tscg`; MIT |
| TOON | toonformat.dev; `toon-format/toon` | benchmark arXiv 2603.03306 |
| Notation Matters (TOON/TRON agentic bench) | arXiv 2605.29676 | — |
| ONTO | arXiv 2604.17512 | — |
| JTON | arXiv 2604.05865 | — |
| AdaEdit / BlockDiff / FuncDiff | arXiv 2604.27296 | — |
| JSON Whisperer | arXiv 2510.04717 | EMNLP 2025 Industry |
| Chain of Draft (CoD) | arXiv 2502.18600 | Zoom |
| TALE (Token-Budget-Aware) | arXiv 2412.18547 | ACL 2025 Findings |
| SelfBudgeter | arXiv 2505.11274 | — |
| Draft-Thinking | arXiv 2603.00578 | — |
| ES-CoT | arXiv 2509.14004 | — |
| Answer Convergence | arXiv 2506.02536 | — |
| ESTAR | arXiv 2602.10004 | — |
| PUMA (Stop When Reasoning Converges) | arXiv 2605.17672 | — |
| REFRAIN (Stop When Enough) | arXiv 2510.10103 | — |
| Gist Tokens | arXiv 2304.08467 | NeurIPS 2023 |
| ICAE | arXiv 2307.06945 | `getao/icae` |
| xRAG | arXiv 2405.13792 | — |
| PCC (Pretraining Context Compressor) | ACL 2025 long 1394 | Microsoft Research |
| ACC-RAG | arXiv 2507.22931 | EMNLP 2025 Findings |
| AttnComp | arXiv 2509.17486 | EMNLP 2025 Findings |
| OSCAR | arXiv 2504.07109 | ICLR 2026 |
| TeaRAG | arXiv 2511.05385 | `Applied-Machine-Learning-Lab/TeaRAG` |
| H2O | arXiv 2306.14048 | NeurIPS 2023 |
| KIVI | arXiv 2402.02750 | `jy-yuan/KIVI`; ICML 2024 |
| SnapKV | arXiv 2404.14469 | `FasterDecoding/SnapKV` |
| PyramidKV | arXiv 2406.02069 | — |
| ChunkKV | arXiv 2502.00299 | — |
| DynamicKV | arXiv 2412.14838 | — |
| SentenceKV | arXiv 2504.00970 | — |
| TurboQuant | arXiv 2504.19874 | — |
| zip2zip | arXiv 2506.01084 | — |
| MATT (Model-Aware Tokenizer Transfer) | arXiv 2510.21954 | tokenizer transfer, not compression |
| VisionZip | arXiv 2412.04467 | `dvlab-research/VisionZip`; CVPR 2025 |
| FastV | arXiv 2403.06764 | ECCV 2024 |
| RouteLLM | arXiv 2406.18665 | `lm-sys/RouteLLM` |
| FrugalGPT | arXiv 2305.05176 | `stanford-futuredata/FrugalGPT`; TMLR |
| Local-Splitter | arXiv 2604.12301 | — |
| GPT Semantic Cache | arXiv 2411.05276 | — |
| OpenAI prompt caching | platform.openai.com/docs/guides/prompt-caching | vendor doc |
| Anthropic prompt caching | docs.anthropic.com/en/docs/build-with-claude/prompt-caching | vendor doc |
| Gemini context caching | ai.google.dev/gemini-api/docs/caching | vendor doc |

---

## 1. Code-Agent Context Pruning

Most relevant to UTK: this is task-aware pruning of *code context* for coding
agents, the workload UTK targets.

**SWE-Pruner** (arXiv 2601.16746, "Self-Adaptive Context Pruning for Coding
Agents"). Task-aware, line-level pruning: the agent formulates an explicit goal
(e.g. "focus on error handling") as a hint, and a lightweight 0.6B neural
"skimmer" (encoder) dynamically selects relevant lines from surrounding context.
Verified metrics: **23–54% token reduction on agent tasks including SWE-bench
Verified while even improving success rates**, and **up to 14.84× compression on
single-turn LongCodeQA** with minimal performance impact. The 0.6B skimmer cost
is amortized by reduced decoding cost. Requires training the skimmer (but not the
frontier model).

UTK relevance: closest external analogue to UTK's mediation goal — preserve
syntactic/logical structure while cutting tokens. The "explicit goal as a pruning
hint" pattern maps onto UTK route summaries; the line-level granularity is a
model for compacting large tool-read outputs. UTK stays training-free, so borrow
the goal-conditioned selection framing but keep it deterministic/heuristic on the
hook path.

## 2. Repo Maps / Code Graphs

**Aider repo-map** (aider.chat docs). Builds a directed graph of symbol
definitions/references across the repo via tree-sitter, ranks with **personalized
PageRank** (edge-weight multipliers: 10× mentioned identifiers, 10× well-named
identifiers, 50× chat files), and renders the top-ranked definitions as
scope-elided code views that fit a **token budget (`--map-tokens`, default 1k)**.
Training-free, deterministic. Apache-2.0.

**RepoGraph** (arXiv 2410.14684, ICLR 2025; `ozyyshr/RepoGraph`). A plug-in
repository-level code graph (line-level definitions/references) that plugs into
existing agent and procedural SWE frameworks. Verified metric: **average relative
improvement of 32.8%** in success rate across four systems on **SWE-bench**;
also validated on **CrossCodeEval**.

UTK relevance: for codebases this beats generic semantic RAG. UTK's code-graph
SDK (see `packages/`) and any "read less first" skill should adopt token-budgeted
graph ranking rather than dumping files. The 50×/10× edge-weight heuristics are a
cheap, deterministic relevance signal worth mirroring.

## 3. Speculative Repo Context

**SpecAgent** (arXiv 2510.17925, "A Speculative Retrieval and Forecasting Agent
for Code Completion"; George Ma et al.). Moves context work to **indexing time**:
proactively explores repo files and builds *speculative* context that anticipates
future edits per file, so inference-time latency is masked and the speculative
context improves code-gen quality. Asynchronous indexing lets it compute context
more thoroughly than an inference-time retrieval budget allows.

UTK relevance: validates precomputing `.utk/` context artifacts ahead of the hot
path rather than at tool-call time. UTK's `utk-init` session-agents/session-skills
already lean this way; SpecAgent is the precedent for "index-time speculation for
latency and quality" and worth citing when justifying eager artifact preparation.

## 4. Tool / Schema Bloat Reduction

MCP/tool definitions are a large *fixed* input-token cost paid every turn. Three
verified approaches, all training-free and directly on UTK's axis:

- **RAG-MCP** (arXiv 2505.03275). Retrieves only the most relevant tool schema
  per query via dense embeddings instead of listing all tools. Verified:
  **>50% prompt-token cut** and tool-selection accuracy **43.13% vs 13.62%**
  baseline (more than 3×). Notes tool schemas can consume 50–80% of context.
- **Semantic Tool Discovery / vector MCP selection** (arXiv 2603.20313).
  Vector-based MCP tool selection. Verified: **99.6% reduction in tool-related
  token consumption**, hit rate **97.1% at K=3**, MRR 0.91.
- **TSCG — Deterministic Tool-Schema Compilation** (arXiv 2605.04107;
  `SKZL-AI/tscg`, MIT). Compiles JSON tool schemas into token-efficient
  structured text with **eight composable operators** and a formal compression
  bound (**≥51% on well-formed schemas**), no model access / fine-tuning /
  runtime search. Verified on TSCG-Agentic-Bench: restores **Phi-4-14B from 0% →
  84.4% tool-use accuracy at 20 tools (90.3% at 50 tools)**; 50 tools compiled in
  2.4 ms; repo claims 50–72% token savings, 459 tests, zero dependencies.

UTK relevance: **highest-priority external pattern** for UTK. UTK already
mediates the Copilot tool-hook pipeline; TSCG's deterministic schema→compact-text
compilation is almost exactly a UTK serializer for tool definitions, and its
"protocol mismatch dominates small-model tool failure" framing is a strong
argument for UTK schema routing. Anthropic's Tool Search / deferred tool loading
(this very session exposes it) is the vendor-native version — track it as the
baseline UTK schema compaction must beat. Retrieval-based selection (RAG-MCP) and
deterministic compilation (TSCG) are complementary: select fewer tools *and*
compile the survivors.

## 5. Structured-Data Notation

Compact serializations for repeated structured payloads/tool results. UTK already
ships TOON and json-compact serializers — the news here is the **accuracy
caveats**, not the savings.

- **TOON** (toonformat.dev; `toon-format/toon`). Drops quotes/braces/brackets,
  uses YAML-like indentation + CSV-style tabular arrays. Vendor/benchmark claims:
  **~30–60% fewer tokens vs JSON** on uniform tabular data; one benchmark reports
  76.4% vs 75.0% accuracy at ~40% fewer tokens across 4 models, another 99.4% on
  GPT-5-Nano at 46% fewer tokens.
- **Benchmark caution 1 — "TOON vs JSON" (arXiv 2603.03306).** Under plain and
  constrained-decoding generation, **plain JSON generation shows the best one-shot
  and final accuracy**; for simple structures, constrained decoding beat even
  TOON. Compression is not free when the model must *generate* the format.
- **Benchmark caution 2 — "Notation Matters" (arXiv 2605.29676).** In agentic
  multi-turn systems, **TRON is the safer drop-in for JSON**, while **TOON's
  stronger compression is offset by accuracy losses in multi-turn settings and is
  not safe as a default.**
- **TRON** (agentic benchmark above) is positioned as the safer JSON drop-in.
- **ONTO** (arXiv 2604.17512, "A Token-Efficient Columnar Notation for LLM Input
  Optimization"). Schema-once, pipe-delimited columnar rows (field names declared
  once per entity). Verified: **46–51% token reduction vs JSON** and **5–10%
  latency improvement** on Qwen2.5-7B synthetic operational-data benchmarks
  (100–1,000 records).
- **JTON** (arXiv 2604.05865, "A Token-Efficient JSON Superset with Zen Grid
  Tabular Encoding"). JSON superset; "Zen Grid" factors column headers into one
  row and encodes values with semicolons, preserving JSON's type system. Verified:
  **15–60% token reduction vs compact JSON (28.5% avg; 32% with bare strings)**
  across 7 domains, +0.3pp comprehension accuracy across 10 models, Rust/PyO3
  parser ~1.4× faster than Python `json`.

Both ONTO and JTON are **payload-format** optimizations (you must control the
serialization), not general natural-language prompt compressors.

UTK relevance: keep TOON as an **opt-in per-tool serializer for
uniform-tabular reads**, not a global default, and gate it on UTK's fact-retention
and recoverability evals — the multi-turn accuracy loss is exactly what those
gates exist to catch. Consider TRON as the safer default candidate to benchmark
against TOON inside `@utk/evals`.

## 6. Patch / Edit Formats

Full-file rewrites waste output tokens; structure-aware diffs preserve edit
quality at lower cost. UTK's `@utk/codegen` is the sibling here.

- **AdaEdit / BlockDiff / FuncDiff** (arXiv 2604.27296, "To Diff or Not to
  Diff?"). BlockDiff and FuncDiff represent changes as **block-level rewrites of
  syntactically coherent units** (control structures, functions); AdaEdit trains
  the model to **adaptively pick the most token-efficient format** (a given diff
  format vs full code) per edit. Verified: **matches full-code-generation accuracy
  while cutting latency and cost by >30% on long-code editing.**
- **JSON Whisperer** (arXiv 2510.04717, EMNLP 2025 Industry). Generates **RFC 6902
  JSON Patch** (only the necessary edits) instead of the full document, plus EASE
  (Explicitly Addressed Sequence Encoding) turning arrays into stable-keyed dicts
  to avoid index-shift errors. Verified: **31% token reduction while staying within
  5% of full-regeneration edit quality**, with gains on complex/list edits.

UTK relevance: strong external validation of `@utk/codegen`'s min-emission /
declare-before-use approach. AdaEdit's **adaptive format choice** (diff vs full,
by measured token cost) is the key idea to adopt: UTK should pick the cheapest
recoverable output format per edit rather than committing to one. Common baselines
to keep in mind: aider's unified-diff format and Anthropic's `str_replace` editor
tool.

## 7. Reasoning-Token Control

These target *generated reasoning tokens*, not input context. Relevant to UTK
session-agents and any `reason-with-lexicon` output, but most require RL/SFT —
so borrow the framing, keep UTK prompt/grammar-level.

| Technique | Source | Verified headline (benchmark / model) | Training? |
|---|---|---|---|
| Chain of Draft (CoD) | 2502.18600 | Matches/surpasses CoT accuracy using **as little as 7.6% of CoT tokens** (GSM8K etc., GPT-4o/Claude) | Prompt-only |
| TALE | 2412.18547 | **68.64% avg output-token reduction** at minor accuracy cost (GSM8K etc.); TALE-EP prompt-only, TALE-PT fine-tuned | Both variants |
| SelfBudgeter | 2505.11274 | **up to 74.47% response-length compression on MATH**, near-equal accuracy; improves accuracy on GSM8K | RL (budget-guided GRPO) |
| Draft-Thinking | 2603.00578 | **82.6% reasoning-budget reduction on MATH500 at −2.6% accuracy** | Curriculum training |

UTK relevance: Chain-of-Draft is the cleanest **prompt-only** win and the right
model for compact UTK reasoning traces / route explanations (pairs well with the
Sketch-of-Thought lexicon work already researched). The budget-aware methods
(TALE/SelfBudgeter/Draft-Thinking) argue for exposing a **reasoning-token budget
knob** in UTK session-agents, but their training requirement keeps them
reference-only for a training-free hook. Do not expose hidden CoT; compact,
visible drafts only.

## 8. Early Stopping for Reasoning

Instead of compressing text after generation, stop when the answer/trajectory
stabilizes. Mostly inference-time, some training-free.

| Technique | Source | Verified headline (benchmark) | Training? |
|---|---|---|---|
| ES-CoT | 2509.14004 | **~41% avg token reduction** across 5 reasoning datasets, 3 model scales, accuracy maintained; stops on run-length spike of stable step-answers | Inference-time |
| Answer Convergence | 2506.02536 | Models converge after ~60% of steps; **>40% token reduction on NaturalQuestions** with accuracy improvement | Inference-time (one variant learned) |
| ESTAR | 2602.10004 | **~3.7× reasoning-length reduction** (4799→1290 tokens) at 74.9% vs 74.2% accuracy | SFT + stop-aware RL |
| PUMA | 2605.17672 | **26.2% avg token reduction**, semantic-preserving early exit when steps stop adding novel progress | Inference-time |
| REFRAIN | 2510.10103 | Reflective-Redundancy for Adaptive Inference; **20–55% token reduction** while maintaining/improving accuracy vs CoT | Training-free |

UTK relevance: the training-free convergence detectors (ES-CoT, Answer
Convergence, PUMA, REFRAIN) are the transferable ones — a UTK session-agent could
stop emitting reasoning once its answer stabilizes, saving output tokens without
model changes. Lower priority than payload mediation but cheap to prototype.

## 9. Soft / Latent Context Compression

Compress text into learned memory tokens/embeddings. Researchy; all need
training or a learned bridge, so these are **reference points**, not
training-free UTK candidates.

- **Gist Tokens** (arXiv 2304.08467, NeurIPS 2023). Trains the LM (via modified
  attention masks, no extra cost over instruction tuning) to compress a prompt
  into a few cacheable "gist" tokens. Verified: **up to 26× prompt compression**,
  up to 40% FLOPs reduction; best for short instructions (~30 tokens).
- **ICAE** (arXiv 2307.06945; `getao/icae`). In-Context AutoEncoder compresses
  long context into compact memory slots. Verified: **4× context compression** on
  Llama with **~1% additional parameters**; handles detailed/complex context
  (question stays uncompressed).
- **xRAG** (arXiv 2405.13792). Reinterprets a document's dense-retrieval embedding
  as a single "modality" token via a trainable bridge (retriever + LM frozen).
  Verified: **retrieved doc → one token**, **3.53× FLOPs reduction**, **>10% avg
  improvement across 6 knowledge-intensive tasks**.
- **PCC — Pretraining Context Compressor** (ACL 2025 long, aclanthology
  2025.acl-long.1394; Microsoft Research). Decoupled compressor→LLM framework,
  pretrained on text reconstruction/completion, storing context as embedding-based
  memory. Verified: **4× and 16× compression are the practical accuracy/speed
  balance points** (256× keeps some useful context but loses more information);
  outperforms baselines across 8 datasets / 3 domains, adaptable to different
  downstream LLMs.

UTK relevance: incompatible with UTK's training-free, model-agnostic hook (they
require training the model or a bridge, and produce non-recoverable embeddings).
Useful only as the theoretical ceiling for "how far compression can go" and as a
contrast: UTK deliberately keeps compact-but-**recoverable** text, not lossy
latent memory.

## 10. RAG-Specific Compression

Reduce retrieved context before generation. Training-free-ish and on-axis for any
UTK RAG surface.

- **ACC-RAG** (arXiv 2507.22931, EMNLP 2025 Findings). Adjusts compression rate by
  query complexity (hierarchical compressor + context selector, "human skimming").
  Verified: **>4× faster inference vs standard RAG** while maintaining/improving
  accuracy across Wikipedia + 5 QA datasets; beats fixed-rate methods.
- **AttnComp** (arXiv 2509.17486, EMNLP 2025 Findings). Uses LLM attention +
  Top-P to keep the minimal document set whose cumulative attention exceeds a
  threshold. Verified: **17× compression rate**, end-to-end latency to **49% of
  uncompressed baseline**, **+1.9 accuracy** over uncompressed on multi-hop QA.
- **OSCAR** (arXiv 2504.07109, ICLR 2026). Query-dependent **online soft**
  compression + reranking at inference time (no offline embedding storage).
  Verified: **2–5× inference speed-up** with minimal/no accuracy loss, 1B–24B
  models.
- **TeaRAG** (arXiv 2511.05385; `Applied-Machine-Learning-Lab/TeaRAG`).
  Token-efficient *agentic* RAG: compresses retrieved content (graph triplets +
  Personalized PageRank) **and** reasoning steps (IP-DPO process-aware rewards to
  cut reasoning iterations). Verified: **+4% Exact Match** with Llama3-8B-Instruct
  across 6 QA datasets while reducing search/reasoning tokens.

UTK relevance: the **adaptive-rate** idea (ACC-RAG: compress by query complexity)
maps onto UTK policy intensity levels; AttnComp's attention-thresholded selection
is a model for choosing which artifact spans to keep. TeaRAG's dual compression
(content + reasoning) mirrors UTK's split between payload mediation and compact
summaries. All are RAG-framed; adopt the mechanisms, keep recoverability.

## 11. KV-Cache Compression / Pruning

**Serving-side only** — these reduce memory/latency/concurrency for self-hosted
serving, **not** Copilot API billable tokens. Relevant to `@utk/model-proxy`
throughput, not to hook-path token wins. Kept compact.

| Technique | Source | Mechanism | Verified headline |
|---|---|---|---|
| H2O | 2306.14048 (NeurIPS 2023) | Heavy-Hitter + recent-token eviction | 20% heavy hitters → up to **29× throughput**, 1.9× lower latency |
| KIVI | 2402.02750 (ICML 2024) | Tuning-free 2-bit (key per-channel, value per-token) | **2.6× less peak memory**, 2.35–3.47× throughput, ~quality-neutral |
| SnapKV | 2404.14469 | Per-head clustered important-position selection | **3.6× gen speed, 8.2× memory** at 16K; up to 380K ctx on one A100-80GB |
| PyramidKV | 2406.02069 | More cache in lower layers, less in higher | **Matches full cache retaining only 12% of KV** (LongBench); +20.5 acc on TREC at 0.7% |
| ChunkKV | 2502.00299 | Semantic chunks as compression units + layer-wise index reuse | **+8.7% precision** over prior, **+26.5% throughput** |
| DynamicKV | 2412.14838 | Task-aware per-layer token retention | **Retains 1.7% of KV cache at ~85% of full-KV LongBench**; +11% over SOTA on NIAH at 0.9% (Mistral-7B) |
| SentenceKV | 2504.00970 | Sentence-level semantic KV: sentence vectors on GPU, per-token KV offloaded to CPU | Memory/latency reduction on PG-19, LongBench, NIAH (not a token-count metric) |
| TurboQuant | 2504.19874 | Online vector quantization (data-oblivious) | KV quant: **quality-neutral at 3.5 bits/channel**, marginal degradation at 2.5 bits/channel |

UTK relevance: reference-only. If UTK ever self-hosts models behind
`@utk/model-proxy`, KIVI (quantization) + PyramidKV/SnapKV (eviction) are the
proven combo. Do **not** present KV savings as UTK token savings — they don't
change billable tokens on the Copilot path.

## 12. Adaptive Tokenization / Token Vocabulary

Attacks token count below the prompt layer.

- **zip2zip** (arXiv 2506.01084). Inference-time adaptive vocabulary: an
  **LZW-based tokenizer** merges tokens into reusable "hypertokens" on the fly,
  a runtime embedding layer handles them, and the model is trained (via PEFT,
  ~10 GPU-hours to convert an existing LLM) to operate on compressed sequences.
  Verified: **20–60% input/output sequence-length reduction**.
- **MATT — Model-Aware Tokenizer Transfer** (arXiv 2510.21954). **Not
  prompt-token compression** — it is tokenizer *transfer* / multilingual tokenizer
  adaptation: an Attention Influence Modeling (AIM) objective distills inter-token
  communication patterns from a source model into a target model with a new
  tokenizer, recovering performance in "a few GPU hours." Track under
  **tokenizer/model adaptation**, not the zip2zip / TokenSugar token-savings
  class; it does not reduce prompt tokens for a fixed model.
- **TokenSugar** — covered in depth in `tokensugar-competitive-research.md`.
  Attacks the below-the-prompt layer via **trained special-token code shorthand**
  (tokenizer vocab additions + continual pretraining) — the same tokenizer-level
  class as zip2zip.
- **Anka** — covered in `anka-competitive-research.md`. **Not** a tokenizer-level
  technique: it is a **prompt-taught, training-free DSL** (a constrained language
  learned in-context, no vocab changes, no fine-tuning). It belongs here only as
  an LLM-native *language-design* alternative to spending tokens, not as evidence
  for the vocab+PEFT argument below.

UTK relevance: the **tokenizer-level** members here (zip2zip, TokenSugar) require
**vocab changes + PEFT/pretraining**, incompatible with UTK's model-agnostic hook.
The GPT-4.1 negative result in the TokenSugar doc (94.5% → 51.2% on untrained
sugarized input) is the standing argument against any *tokenizer-level* scheme in
a UTK hot path. Anka's training-free DSL approach does not carry that constraint,
but adopting a bespoke language is its own non-goal (see its doc). All
reference-only for UTK.

## 13. Multimodal / Visual Token Pruning

Relevant only if UTK handles screenshots, PDFs, diagrams, or UI-agent frames.
Fast-moving; two canonical baselines:

- **FastV** (arXiv 2403.06764, ECCV 2024). Training-free; prunes low-attention
  visual tokens after the second LLM layer. Standard baseline.
- **VisionZip** (arXiv 2412.04467, CVPR 2025; `dvlab-research/VisionZip`). Selects
  dominant visual tokens by attention, merges the rest by semantic similarity.
  Verified: **retaining only 10% of visual tokens keeps ~95% of performance** in
  training-free mode; ~2× memory / 2× training-time savings in tuned mode.

UTK relevance: only if UTK mediates non-text tool payloads with image content.
Then visual-token pruning belongs on the *provider/model* side, not UTK's hook —
UTK's job would be to persist the raw image artifact and pass a compact reference,
not to prune tokens inside the VLM. Reference-only for now.

## 14. Prompt / Semantic Caching

Often more practical than compression, and fully compatible with UTK (caching a
compact UTK-serialized prefix compounds the savings).

**Provider prompt caching (verified vendor docs, cited individually so the
time-sensitive TTL/discount figures stay re-checkable):**
- **OpenAI** (platform.openai.com/docs/guides/prompt-caching): automatic for
  prompts >1024 tokens, no code change, no extra fee; **up to 80% latency and up
  to 90% input-cost reduction** for repeated prefixes.
- **Anthropic** (docs.anthropic.com/en/docs/build-with-claude/prompt-caching):
  cache **write 1.25× (5-min TTL) or 2.0× (1-hour TTL)** base input; cache **read
  0.10×** (90% discount). Explicit `cache_control` markers.
- **Gemini** (ai.google.dev/gemini-api/docs/caching): implicit (automatic) +
  explicit context caching; **50–90% cost reduction** depending on
  context-to-query ratio.

**Semantic response caching:**
- **GPT Semantic Cache** (arXiv 2411.05276) / GPTCache pattern. Embeds queries,
  serves stored responses for semantically similar ones (Redis). Verified:
  **up to 68.8% reduction in API calls**, 61.6–68.8% hit rate, >97% positive-hit
  accuracy. **Needs correctness/security controls** — a wrong cache hit is a
  correctness bug, and cross-user cache sharing is a data-leak risk.

UTK relevance: **highest practical ROI, lowest effort, and compounding.** UTK
should (a) structure serialized output so stable prefixes (tool schemas, system
context) are cache-friendly, maximizing provider prompt-cache hits, and (b) treat
semantic response caching as an optional layer with the same recoverability/safety
gating UTK applies elsewhere — never a semantic hit on security-relevant or
volatile output (cf. `detectCacheVolatility`).

## 15. Local Triage / Draft-Review Routing

Use a small local model to route/compress/draft, escalate only hard work to
frontier models. Directly relevant to `@utk/model-proxy`.

- **Local-Splitter** (arXiv 2604.12301, "A Measurement Study of Seven Tactics for
  Reducing Cloud LLM Token Usage on Coding-Agent Workloads"). Evaluates seven
  tactics (local routing, prompt compression, semantic caching, local draft +
  cloud review, minimal-diff edits, structured intent extraction, batch + vendor
  prompt caching) individually/paired/greedy-additive across four workload classes
  (edit-heavy, explanation-heavy, general chat, RAG-heavy). Verified: **45–79%
  cloud-token savings on edit-/explanation-heavy workloads** for local routing +
  prompt compression; **local routing alone is the single strongest tactic
  (29–69%)**; RAG-heavy full-set with draft-review reaches 51%. Ships an
  **open-source shim speaking both MCP and an OpenAI-compatible HTTP surface**
  (local via Ollama, cloud via any OpenAI-compatible endpoint).
- **RouteLLM** (arXiv 2406.18665; `lm-sys/RouteLLM`). Preference-data-trained
  routers. Verified: **95% of GPT-4 performance** using ~26% GPT-4 calls (~48%
  cheaper); **>85% cost reduction on MT-Bench, 45% on MMLU, 35% on GSM8K** vs
  GPT-4-only.
- **FrugalGPT** (arXiv 2305.05176, TMLR; `stanford-futuredata/FrugalGPT`). LLM
  cascade (small→large until good enough) + prompt adaptation + approximation.
  Verified: **matches best individual LLM with up to 98% cost reduction**, or +4%
  accuracy at equal cost.

UTK relevance: **Local-Splitter is the most direct competitor/precedent for
`@utk/model-proxy` plus UTK's Copilot mediation** — same MCP + OpenAI-compatible
surface, same workload framing, and it independently quantifies the payoff of
tactics UTK already implements (compression, minimal-diff edits, structured intent,
vendor caching). Treat its seven-tactic taxonomy as a benchmark checklist for
`@utk/model-proxy`, and its numbers as the bar UTK's proxy must meet or beat.
RouteLLM/FrugalGPT are the canonical routing/cascade references.

The full model-level landscape — pre-call routing, cascade routing, selective and
full ensembling, batch-aware routing, and decode-time (speculative) methods — is
broken out as a dedicated deep-dive tree in [`models/`](/research/model-routing/overview.md), with one
verified brief per technique. That folder is the expansion of this section; keep the
scope discipline consistent (routing/ensemble cut expected `$/task`, not billable
token count; speculative decoding is self-hosted latency only).

---

## Prioritization For UTK

Ranked by fit with UTK's hook-first, training-free, Copilot-centric core:

1. **Tool/schema reduction (§4)** — TSCG-style deterministic schema compilation +
   RAG-MCP-style selection. Nearly a UTK serializer already; biggest fixed-cost
   win per turn; benchmark against Anthropic's native tool-search.
2. **Provider + semantic caching (§14)** — highest practical ROI, compounding with
   UTK serialization; make output cache-prefix-friendly.
3. **Local routing / draft-review (§15)** — Local-Splitter is the direct precedent
   for `@utk/model-proxy`; adopt its tactic taxonomy as a benchmark.
4. **Code-agent context pruning + repo maps (§1–3)** — SWE-Pruner goal-conditioned
   line pruning, token-budgeted PageRank repo maps, index-time speculation.
5. **Patch/edit formats (§6)** — AdaEdit adaptive format choice validates and
   extends `@utk/codegen`.
6. **Structured-data notation (§5)** — already shipped; the actionable finding is
   the multi-turn accuracy caveat and TRON as a safer default to evaluate.
7. **RAG-time compression (§10)** — adaptive-rate + attention-thresholded
   selection ideas for UTK policy intensity.
8. **Reasoning control / early stopping (§7–8)** — borrow prompt-only Chain-of-Draft
   and convergence-stop for session-agents; most budget methods need training.
9. **Reference-only:** soft/latent compression (§9), KV-cache (§11), adaptive
   tokenization (§12), visual pruning (§13) — require training, vocab changes, or
   are serving-side; they inform `@utk/model-proxy` and set ceilings, but do not
   belong on the training-free Copilot hook path.

## Risks And Non-Goals

- Do not treat serving-side KV/visual-token savings (§11, §13) as UTK token
  savings; they don't change billable Copilot tokens.
- Do not adopt any technique requiring frontier-model retraining or vocab surgery
  (§9, §12, most of §7) on the hook path — model-agnosticism is UTK's core.
- Do not default to maximum-compression notation (TOON) in multi-turn agent loops;
  two independent benchmarks (§5) show accuracy loss — gate on UTK evals.
- Do not enable semantic response caching (§14) without correctness + cross-user
  isolation controls; a wrong hit is a correctness/security bug.
- Do not let any "intensity"/compression knob weaken recoverability or drop exact
  diagnostics — the same discipline as the Ponytail/SoT notes.

## Verification Status

The initial pass verified the bulk of the landscape (SWE-Pruner, SpecAgent,
RepoGraph, Aider repo-map, RAG-MCP, vector MCP selection, TSCG, TOON + both
TOON/TRON benchmark papers, AdaEdit/BlockDiff/FuncDiff, JSON Whisperer,
Chain-of-Draft, TALE, SelfBudgeter, Draft-Thinking, ES-CoT, Answer Convergence,
ESTAR, PUMA, Gist Tokens, ICAE, xRAG, ACC-RAG, AttnComp, OSCAR, TeaRAG, H2O,
KIVI, SnapKV, PyramidKV, ChunkKV, zip2zip, VisionZip, FastV, RouteLLM, FrugalGPT,
Local-Splitter, GPT Semantic Cache, OpenAI/Anthropic/Gemini caching) against a
primary source on 2026-07-02.

A follow-up pass pinned the remaining eight source-brief names to primary
sources — so none are "unverified"; several are **verified but differently
scoped** than the original brief implied (MATT and the KV-cache methods are moved
out of billable prompt-token reduction):

| Technique | Status | Primary source / correction |
|---|---:|---|
| **ONTO** | Verified | **arXiv:2604.17512**, "ONTO: A Token-Efficient Columnar Notation for LLM Input Optimization." **46–51% token reduction vs JSON**, **5–10% latency improvement** on Qwen2.5-7B synthetic operational-data benchmarks. |
| **JTON** | Verified | **arXiv:2604.05865**, "JTON: A Token-Efficient JSON Superset with Zen Grid Tabular Encoding." **15–60% token reduction vs compact JSON** (28.5% avg; 32% with bare strings). |
| **PCC** | Verified | ACL 2025 long, "Pretraining Context Compressor for Large Language Models with Embedding-Based Memory" (Microsoft Research). Implicit/embedding-based compressor; **4× and 16× are the practical balance points**, 256× loses more information. |
| **MATT** | Verified, recategorized | **arXiv:2510.21954**, "Model-Aware Tokenizer Transfer." **Not** prompt-token compression — tokenizer transfer / multilingual adaptation via Attention Influence Modeling. Track under **tokenizer/model adaptation**. |
| **DynamicKV** | Verified | **arXiv:2412.14838**. **KV-cache** compression, not billable tokens. Retains **1.7% KV cache at ~85% of full-KV LongBench**. |
| **SentenceKV** | Verified | **arXiv:2504.00970**. Sentence-level semantic KV caching (sentence vectors on GPU, per-token KV offloaded to CPU). Runtime memory/latency, not token count. |
| **TurboQuant** | Verified | **arXiv:2504.19874**, "Online Vector Quantization with Near-optimal Distortion Rate." KV-cache quantization: quality-neutral at 3.5 bits/channel. |
| **REFRAIN** | Verified | **arXiv:2510.10103**, "Stop When Enough: Adaptive Early-Stopping for Chain-of-Thought Reasoning." Reflective-Redundancy for Adaptive Inference; **20–55% token reduction** vs CoT. |

### Metric corrections

| Technique | Correction |
|---|---|
| **TALE** | Phrase as **TALE / TALE-EP reduces token costs by 68.64% on average**, not a single-benchmark headline; the abstract describes dynamic budget estimation by reasoning complexity, and the 68.64% figure is in the reported results / ACL version. |
| **MATT** | Do not present as "adaptive tokenization for token savings" alongside zip2zip; it is **model-aware tokenizer transfer** for adapting an LLM to a new tokenizer/language with less warm-up cost. |
| **DynamicKV / SentenceKV / TurboQuant** | Reduce **KV-cache memory / inference overhead**, not billed input/output tokens; matter for self-hosted inference, long-context serving, and concurrency. |
| **ONTO / JTON** | Structured-data **serialization** optimizations — reduce input tokens only when you control the payload format; not general natural-language prompt compressors. |

All metrics are as reported by the technique's own authors/vendors unless a named
independent benchmark is cited; they are not independently reproduced in this
workspace.
