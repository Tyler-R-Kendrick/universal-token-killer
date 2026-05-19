# Sketch-of-Thought Competitive Research

Internal note. Do not link this document from the public README unless the
competitive strategy becomes intentionally public.

Research date: 2026-05-19
Primary paper: https://arxiv.org/abs/2503.05179
Hugging Face paper page: https://huggingface.co/papers/2503.05179
Router model: https://huggingface.co/saytes/SoT_DistilBERT
Official repository: https://github.com/SimonAytes/SoT
Observed official repository revision: `94c6b8d17f3fe7f7fe536ddc868e257bdfe9d654`
Observed model revision: `c95f17f27678e4ea65120cfbfdc2fa5ebb07773f`
Observed arXiv version: v4, last revised 2025-10-24

## Citation Ledger

Use this ledger when re-checking or citing claims. Source labels are used
throughout this note.

| ID | Source | Evidence captured |
|---|---|---|
| SOT-ARXIV | arXiv abstract page, `arXiv:2503.05179` | Title, authors, submitted/revised dates, DOI, EMNLP 2025 note, abstract claims, three paradigms, lightweight router, up-to-84% token reduction. |
| SOT-HF-PAPER | Hugging Face paper page `2503.05179` | HF publication date, submitter, community author note, 76%/15-dataset summary, links to GitHub and model, model citation count. |
| SOT-HF-MODEL | Hugging Face model card `saytes/SoT_DistilBERT` | Model task, license, tags, usage snippets, label mapping, training sample count, architecture/training hyperparams, package formats, dataset list, limitations section. |
| SOT-HF-API | Hugging Face model API for `saytes/SoT_DistilBERT` | Exact model SHA, downloads/likes at research time, base model tag, safetensors parameter count, storage size, sibling files. |
| SOT-GITHUB | Official GitHub repository `SimonAytes/SoT` | Package layout, README usage, supported languages/formats, citation block, MIT license, no release packages. |
| SOT-CODE | Local shallow clone of official repo at `94c6b8d...` | `SoT` class behavior, prompt/exemplar loading, model loading, route inference, config files, prompts, dependencies. |
| SOT-PAPER-SRC | arXiv source tarball for v4 | Method text, result tables, appendix dataset table, router ablation table, classification prompt, limitations/future work. |

## Canonical Citation

The upstream repository asks users to cite:

```bibtex
@misc{aytes2025sot,
      title={Sketch-of-Thought: Efficient LLM Reasoning with Adaptive Cognitive-Inspired Sketching},
      author={Simon A. Aytes and Jinheon Baek and Sung Ju Hwang},
      year={2025},
      eprint={2503.05179},
      archivePrefix={arXiv},
      primaryClass={cs.CL},
      url={https://arxiv.org/abs/2503.05179},
}
```

arXiv also lists DOI `10.48550/arXiv.2503.05179`.

## Install And Configuration Status

Sketch-of-Thought was researched from the paper, Hugging Face paper page, Hugging
Face model card/API, arXiv source tarball, and a temporary shallow clone of the
official repository. It was not installed, run, or configured in this UTK
workspace.

Documented package install path from the official repo:

```bash
git clone https://github.com/SimonAytes/SoT.git
cd SoT
conda create -n sot python=3.10 -y
conda activate sot
pip install -r requirements.txt
pip install -e .
```

Direct model load path from Hugging Face:

```python
from transformers import AutoTokenizer, AutoModelForSequenceClassification

tokenizer = AutoTokenizer.from_pretrained("saytes/SoT_DistilBERT")
model = AutoModelForSequenceClassification.from_pretrained("saytes/SoT_DistilBERT")
```

Important caveats:

- SoT is a prompting framework and helper package, not a tool hook, serializer,
  artifact store, CLI rewrite engine, or MCP server.
- The official package loads the router model from Hugging Face at runtime by
  default; it is not local/offline unless the HF model is cached or vendored.
- The implementation ships fixed prompts and exemplars; it does not implement
  grammar-constrained decoding.
- The model card says router labels were assigned by GPT-4o using predefined
  heuristics. The routing model therefore inherits teacher-label bias.
- Source counts differ by surface: arXiv v4 claims 18 reasoning datasets and up
  to 84% reduction; the Hugging Face paper page summarizes 15 datasets and 76%;
  the model card lists 14 evaluation datasets; the arXiv source appendix table
  lists 19 dataset entries including multilingual and multimodal datasets.

## Core Positioning

Sketch-of-Thought (SoT) compresses model-visible reasoning, not input files or
tool outputs. It replaces verbose Chain-of-Thought with compact, paradigm-guided
"sketches" inside `<think>...</think>` and a final boxed answer. The framework
selects one of three cognitive-inspired reasoning styles per query:

- Conceptual Chaining for commonsense, fact recall, logical, and multi-hop
  concept links.
- Chunked Symbolism for arithmetic, algebra, physics, unit conversion, and
  formulaic computation.
- Expert Lexicons for domain-specific jargon, acronyms, shorthand, and dense
  expert notation.

This differs from UTK's intended center:

- SoT compresses intermediate reasoning emitted by an LLM.
- UTK mediates GitHub Copilot tool calls, persists raw outputs, infers schemas,
  routes outputs, and returns compact recoverable responses.

The overlap worth studying is substantial: adaptive routing, expert-lexicon
compression, compact formalized intermediate state, task-specific compression
policies, multilingual prompt packs, and metrics that pair token reduction with
accuracy/fact retention.

## Capability Inventory

| Capability | What it does | How SoT implements it | UTK relevance |
|---|---|---|---|
| Reasoning compression | Shortens intermediate reasoning while preserving answers. | Paradigm prompts force `<think>` sketches plus final `\boxed{...}` answer. | Useful for UTK's dynamic session-agents and reasoning summaries, but not a replacement for raw artifact recovery. |
| Conceptual Chaining | Represents reasoning as linked concepts. | Prompt asks for key concept extraction, arrows, no full sentences, and logical sequence. | Good pattern for route explanations and dependency traces. |
| Chunked Symbolism | Represents numerical reasoning as variables/equations. | Prompt asks for variable extraction, explicit equations, unit labels, small computations. | Relevant to command/schema templates for CLI arguments and numeric tool outputs. |
| Expert Lexicons | Uses domain shorthand and symbols. | Prompt instructs technical notation, abbreviations, and high-information expressions. | Directly relevant to UTK's planned `reason-with-lexicon` tool and formal grammar/lexicon compression. |
| Adaptive router | Picks a paradigm for each query. | Fine-tuned DistilBERT sequence classifier predicts one of three labels from the question. | UTK can route serializers/templates/schemas with lightweight deterministic or learned routers, but needs fail-open and confidence handling. |
| Router model card | Makes the router reusable. | `saytes/SoT_DistilBERT`, text-classification, MIT license, DistilBERT base, safetensors, 66,955,779 parameters. | Useful as a concrete small-router pattern; UTK should not require remote model fetch by default. |
| Machine-labeled router training | Avoids manual labeling at scale. | Paper/model card describe about 14,200 samples labeled by GPT-4o using a classification prompt. | UTK could bootstrap schema/route labels from generated heuristics, but CI should validate against hand-authored fixtures. |
| Classification prompt | Defines routing semantics. | Appendix prompt describes paradigm purpose, linguistic indicators, examples, and output-only label requirement. | Strong precedent for making routing rules auditable before training or distillation. |
| Prompt packs | Ships paradigm prompts for multiple languages. | Repo contains EN, KR, IT, and DE system prompts for CoT and the three SoT paradigms. | UTK should keep serializer/prompts provider-specific and language-aware only when needed. |
| Exemplars | Provides few-shot demonstrations. | `exemplars.json` has language/paradigm examples for conceptual, symbolic, expert, and CoT styles. | Useful for generated skills/subagents. UTK should keep examples compact and separated from core code. |
| Multiple output formats | Supports different model interfaces. | `get_initialized_context` returns `llm`, `vlm`, or `raw` formats. | UTK serializers similarly need format providers with explicit contracts. |
| Multimodal compatibility | Adapts prompt wrapping for VLMs. | VLM format wraps content as text/image message parts; router uses placeholder for image/document context in paper. | Relevant to non-shell tool calls with images/binary/structured payload envelopes. |
| Multilingual support | Runs SoT prompts/exemplars in Korean, Italian, and German in the paper. | Non-English queries use translated prompts/exemplars; paper routes using English counterpart for multilingual eval. | UTK should avoid language assumptions in artifact summaries and tests. |
| Broad eval matrix | Measures accuracy and tokens across model families and reasoning types. | Paper evaluates Qwen, Llama, GPT-4o, Claude Sonnet 3.5, multilingual MMMLU, multimodal ScienceQA/GQA, and ensembles. | UTK should preserve this two-axis metric: compactness plus correctness/fact retention. |
| Router ablation | Compares small routers. | Appendix compares DistilBERT, GPT-2, BERT-base, and BERT-large on accuracy/latency/VRAM. | Good pattern for UTK route model selection if a learned router is ever introduced. |
| Ensemble substitution | Replaces CoT inside multi-pass methods. | Paper swaps SoT into Self-Consistency, Self-Refine, and Multi-Agent Debate. | Relevant to UTK dynamic session-agents: compact reasoning can reduce multi-agent overhead. |
| Explicit limitations | Admits fixed exemplars limit adaptability and suggests retrieval/new paradigms. | Limitations section names dynamic exemplar retrieval, new paradigms, code generation, and low-resource languages. | UTK should document where static schemas/templates fail and when dynamic generation is needed. |

## Implementation Mechanics

### Package Flow

The official package exposes a single `SoT` class:

1. Load `saytes/SoT_DistilBERT` with `DistilBertForSequenceClassification`.
2. Load `DistilBertTokenizer`.
3. Load `label_mapping.json`.
4. Preload prompts from `config/prompts/<LANG>/`.
5. Preload exemplars from `config/exemplars.json`.
6. Classify questions by argmax over router logits.
7. Return initialized contexts in `llm`, `vlm`, or `raw` shape.

The code path is simple and reviewable, but it has no confidence threshold,
fallback paradigm, batching API, offline model configuration, or formal
validation of generated reasoning. For UTK, those are required if a router can
change actual tool execution or serialized output.

### Prompt Contracts

All three English prompts share a strict output envelope:

```text
<think>
[compressed reasoning]
</think>
\boxed{[Final answer]}
```

The prompts explicitly ask for minimal words and no restatement of the question.
They differ by representation:

- Conceptual Chaining: key terms linked with arrows.
- Chunked Symbolism: variables, equations, arithmetic, units.
- Expert Lexicons: symbols, abbreviations, field notation.

This maps cleanly to UTK's desired "reason-with-lexicon" idea, but UTK should
enforce lexicons/templates with llguidance or schema validation rather than
prompt-only compliance.

### Router Training And Labels

The paper and model card describe the router as a DistilBERT classifier trained
on about 14,200 examples. GPT-4o supplied labels via a classification prompt
that defines the three paradigms, linguistic indicators, examples, and a strict
plain-label output format. The paper's Appendix also evaluates router choices:

| Candidate | Params | Accuracy | Latency | VRAM |
|---|---:|---:|---:|---:|
| DistilBERT | 67M | 90.31 | 0.0118s | 283 MB |
| GPT-2 | 137M | 91.11 | 0.0107s | 652 MB |
| BERT-base | 110M | 90.93 | 0.0139s | 445 MB |
| BERT-large | 336M | 88.93 | 0.0259s | 1309 MB |

The paper later reports 96.4% overall router accuracy against GPT-4o-assigned
ground truth on primary-experiment samples, with recall of 0.964 for Conceptual
Chaining, 0.975 for Chunked Symbolism, and 0.907 for Expert Lexicons. These are
not independent human labels; they validate against the same teacher-labeling
protocol.

### Evaluation Results

The paper's main table reports aggregate results across seven model settings:
Qwen2.5-32B, Qwen2.5-14B, Qwen2.5-7B, Llama 3.1-8B, Llama 3.2-11B, GPT-4o,
and Claude Sonnet 3.5.

The all-model aggregate:

| Method | Accuracy | Output tokens | Reduction vs CoT | Accuracy delta vs CoT |
|---|---:|---:|---:|---:|
| CoT | 78.12 | 233 | -- | -- |
| CoD | 74.26 | 54 | 76.82% | -3.86 |
| CCoT | 73.48 | 71 | 69.53% | -4.64 |
| SoT | 77.29 | 59 | 74.68% | -0.83 |

Notable model-specific examples:

- GPT-4o: SoT 84.55 accuracy, 57 tokens, 76.20% reduction, -0.09 delta.
- Claude Sonnet 3.5: SoT 84.50 accuracy, 80 tokens, 68.99% reduction, -0.51
  delta.
- Qwen2.5-32B: SoT 82.30 accuracy, 57 tokens, 74.36% reduction, +0.06 delta.

Multilingual table:

| Language | CoT tokens | SoT tokens | SoT accuracy delta | Reduction |
|---|---:|---:|---:|---:|
| Korean | 308 | 49 | -0.80 | 84.09% |
| Italian | 332 | 57 | -1.33 | 82.83% |
| German | 306 | 48 | -0.33 | 84.31% |

Multimodal table:

| Dataset | CoT tokens | SoT tokens | SoT accuracy delta | Reduction |
|---|---:|---:|---:|---:|
| ScienceQA | 136 | 27 | +6.60 | 80.15% |
| GQA | 79 | 19 | -2.50 | 75.95% |

Paradigm alignment examples:

- SVAMP mathematical: Chunked Symbolism wins with 93.70 accuracy at 30 tokens.
- MedQA medical: Expert Lexicons wins with 85.70 accuracy at 52 tokens.
- CommonsenseQA: Conceptual Chaining wins with 84.60 accuracy at 21 tokens.

### Dataset Surface

The official repo/model card list 14 SoT_DistilBERT evaluation datasets:
GSM8K, SVAMP, AQUA-RAT, DROP, OpenbookQA, StrategyQA, LogiQA, Reclor,
HotPotQA, MuSiQue-Ans, QASC, Worldtree, PubMedQA, and MedQA.

The arXiv source appendix table lists a broader paper dataset inventory:
GSM8K, SVAMP, AQUA-RAT, DROP, OpenbookQA, StrategyQA, LogiQA, Reclor,
HotPotQA, MuSiQue-Ans, QASC, Worldtree, PubMedQA, MedQA, CommonsenseQA,
MMLU, MMMLU, ScienceQA, and GQA.

For future UTK citations, prefer specifying exactly which table/page is being
used rather than saying "SoT used N datasets" without qualification.

## Competitive Implications For UTK

SoT competes with UTK only on one layer: reducing model-visible reasoning tokens
while preserving correctness. It does not mediate tool IO or persist exact raw
artifacts. Still, it is directly relevant to UTK's planned dynamic subagents,
session skills, and `reason-with-lexicon` tooling.

Where SoT is strong:

- compact reasoning traces with task-specific formats;
- lightweight paradigm selection;
- clear prompt/exemplar separation;
- multilingual and multimodal packaging concepts;
- measured token/accuracy trade-offs;
- explicit expert-lexicon compression, which aligns with UTK's grammar plans.

Where UTK can stay stronger:

- exact raw tool-output artifacts;
- schema inference, routing, and recovery handles;
- serializer provider validation through TOON/compressed JSON;
- GitHub Copilot hook mediation for shell and non-shell tools;
- RTK parity metrics for fact retention and recoverability;
- local `.utk/` state without requiring HF model downloads.

## Competitive Opportunities For UTK

1. Implement `reason-with-lexicon` as a formal llguidance-backed grammar/tool,
   not a prompt-only SoT clone.
2. Generate SoT-style expert lexicons per tool/schema in `.utk/`, then reference
   lexicon IDs instead of spending prompt tokens on full definitions.
3. Add a router interface for reasoning/serialization templates with confidence,
   deterministic fallback, and config overrides.
4. Use SoT's paradigm split for UTK route summaries:
   Conceptual Chaining for dependency/fact graphs, Chunked Symbolism for numeric
   metrics and command arguments, Expert Lexicons for domain-specific tool
   output.
5. Add eval fixtures that score compact reasoning traces on fact retention,
   not just token count.
6. Compare UTK's compact tool responses against SoT-style prompt summaries to
   show why raw artifact recovery is still necessary.
7. Add multilingual smoke fixtures for serializer metadata, especially where
   tool outputs contain non-English diagnostic text.
8. Treat fixed exemplars as a cacheable artifact, but add dynamic exemplar
   retrieval only when measured token savings beat retrieval overhead.
9. If UTK uses a learned router, keep the model optional, local-cacheable, and
   test-gated. No runtime network fetch on default hook path.
10. Extend session-agent generation to require sketch-of-thought-style outputs
    with machine-checkable grammar envelopes.

## Risks And Non-Goals

- Do not expose or rely on hidden chain-of-thought. SoT's public examples put
  compact reasoning in `<think>`; UTK should expose compact artifacts and
  summaries, not private reasoning traces.
- Do not replace exact raw artifacts with SoT summaries.
- Do not use a remote Hugging Face model fetch in Copilot hook hot paths.
- Do not trust GPT-4o-generated router labels without independent regression
  fixtures.
- Do not assume Expert Lexicons are safe without domain-specific validation;
  abbreviations can be ambiguous.
- Do not use prompt-only formatting where llguidance/schema validation is
  available.
- Do not cite SoT dataset counts without naming the source surface because the
  paper, HF page, model card, and appendix use different counts/scopes.

## Source Notes And Discrepancies

- arXiv page: submitted 2025-03-07, last revised 2025-10-24, v4, EMNLP 2025,
  DOI `10.48550/arXiv.2503.05179`.
- arXiv abstract: three paradigms and dynamic router; token reductions up to
  84% across 18 reasoning datasets.
- Hugging Face paper page: published 2025-03-07, submitted by Jinheon Baek on
  2025-03-10; AI summary says 76% token reduction across 15 datasets.
- Hugging Face author comment: says average 75% across tasks and no additional
  training/fine-tuning for the LLMs; router model and package are linked.
- Hugging Face model card: MIT license, text classification, DistilBERT,
  `sketch-of-thought`, `efficient-inference`, English; model description says
  about 14,200 samples, 5 epochs, batch size 64, learning rate `2e-5`, cross
  entropy.
- Hugging Face API: model SHA `c95f17f27678e4ea65120cfbfdc2fa5ebb07773f`,
  `DistilBertForSequenceClassification`, 66,955,779 F32 parameters, 267,835,644
  bytes used storage, `model.safetensors`, `label_mapping.json`, tokenizer
  files, 930 downloads and 7 likes at research time.
- Official repo: package version `0.1.0`, Python `>=3.10`, dependencies pin
  `transformers==4.30.0`, `torch==2.0.1`, `tokenizers==0.13.3`,
  `numpy==1.26.4`, and `loguru==0.7.3`.
- Official repo has no release published on GitHub at research time.

## Source Files Reviewed

Official repository:

- `README.md`
- `pyproject.toml`
- `requirements.txt`
- `LICENSE`
- `sketch_of_thought/__init__.py`
- `sketch_of_thought/sketch_of_thought.py`
- `sketch_of_thought/config/config.py`
- `sketch_of_thought/config/label_mapping.json`
- `sketch_of_thought/config/exemplars.json`
- `sketch_of_thought/config/prompts/EN/EN_ChunkedSymbolism_SystemPrompt.md`
- `sketch_of_thought/config/prompts/EN/EN_ConceptualChaining_SystemPrompt.md`
- `sketch_of_thought/config/prompts/EN/EN_ExpertLexicons_SystemPrompt.md`
- corresponding KR, IT, and DE prompt directories by file inventory

arXiv source:

- `main.tex`
- `sections/02_methodology.tex`
- `sections/04_results.tex`
- `sections/07_limitations_future_work.tex`
- `_tables/table_main_results.tex`
- `_tables/table_multilingual_results.tex`
- `_tables/table_multimodal_results.tex`
- `_tables/table_paradigm_specific_performance.tex`
- `_tables/APPENDIX_Datasets.tex`
- `_tables/APPENDIX_Router_Model_Selection.tex`
- `_tables/APPENDIX_Dominant_Paradigms.tex`
- `appendices/APP_01_AdditionalInformation.tex`
- `appendices/APP_ClassificationPrompt.tex`
