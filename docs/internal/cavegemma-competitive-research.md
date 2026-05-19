# CaveGemma Competitive Research

Internal note. Do not link this document from the public README unless the
competitive strategy becomes intentionally public.

Research date: 2026-05-19
Upstream repository: https://github.com/JuliusBrussee/cavegemma
Observed upstream revision: `6b4ad4cb2a6aa27b604bb7e8bf73c45acac05f94`

## Install And Configuration Status

CaveGemma was researched from the public repository and a temporary shallow
clone only. It was not installed, run, or configured in this UTK workspace.

Documented upstream quick-start paths:

```python
from transformers import AutoModelForCausalLM, AutoTokenizer

tok = AutoTokenizer.from_pretrained("JBrussee/gemma-4-31B-caveman")
model = AutoModelForCausalLM.from_pretrained(
    "JBrussee/gemma-4-31B-caveman",
    torch_dtype=torch.bfloat16,
    device_map="auto",
)
```

Documented upstream LoRA path:

```python
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer

base = AutoModelForCausalLM.from_pretrained("google/gemma-4-31B-it")
tok = AutoTokenizer.from_pretrained("google/gemma-4-31B-it")
model = PeftModel.from_pretrained(base, "JBrussee/gemma-4-31B-caveman-lora")
```

Important caveats:

- CaveGemma is a model fine-tune, not a hook, skill, MCP server, serializer, or
  tool-output mediator.
- The README advertises two Hugging Face artifacts: a 62.5 GB merged bf16 model
  and a 534 MB LoRA adapter.
- The fine-tune inherits Gemma model terms for weights/adapters. The repo code
  is MIT, and the Caveman style rules/seed pairs are MIT.
- The pipeline depends on GPU training infrastructure, Unsloth, TRL, PEFT,
  transformers, Hugging Face datasets, and optional Claude/Codex CLI synthesis.
  That surface is research-useful but out of scope for UTK's hook-first runtime.

## Core Positioning

CaveGemma's value proposition is "Caveman baked into weights." Instead of
installing a Caveman skill, adding a system prompt, or toggling `/caveman`, the
model itself is fine-tuned to answer in terse technical fragments while
preserving code blocks, error strings, API names, and command text.

This differs from UTK's intended center:

- CaveGemma compresses assistant output by changing model behavior.
- UTK compresses and mediates tool input/output, persists raw artifacts, infers
  schemas, routes outputs, and returns compact recoverable responses.

The overlap worth studying is not delivery surface. It is the eval and data
discipline around "compression without fact loss": code-fence exactness,
article/filler density, semantic similarity, category-specific compression
bands, and explicit limitations where compression underperforms gold pairs.

## Capability Inventory

| Capability | What it does | How CaveGemma implements it | UTK relevance |
|---|---|---|---|
| Native terse output | Makes the base model answer in Caveman style without prompt rules at inference time. | Fine-tunes `google/gemma-4-31B-it` with QLoRA on source/target pairs where targets follow Caveman rules. | Useful reference for optional model-side compression, but not a replacement for deterministic tool mediation. |
| Merged model artifact | Provides a drop-in full model. | Publishes `JBrussee/gemma-4-31B-caveman` as a bf16 merged model, advertised as 62.5 GB. | Not practical for UTK's default product. Large weights should not be required for hooks. |
| LoRA adapter artifact | Provides a lighter adapter on top of the base model. | Publishes `JBrussee/gemma-4-31B-caveman-lora`, advertised as 534 MB. | Possible future optional local summarizer backend, but still too heavy for default UTK. |
| Caveman rules source | Uses the original Caveman skill as style authority. | `data/seeds/skill_md.md` snapshots the Caveman skill; `data/synthesize.py` appends it to rewrite instructions. | UTK should similarly keep route/schema rules as auditable source files, not only implicit model behavior. |
| Synthetic data generation | Converts normal technical content into Caveman pairs. | `data/synthesize.py` drives `claude -p` or `codex exec`; some sources require a normalize step before Caveman rewrite. | UTK eval fixture generation can borrow the two-step normalize-then-compress pattern. |
| Resume-by-hash synthesis | Avoids losing progress during rate limits. | Existing output keys are read from JSONL; new rows use a SHA-1-derived origin key; concurrent workers append save-as-you-go. | Useful for UTK benchmark generation and optional live RTK comparisons. |
| Corpus assembly | Pulls workflow-rich technical examples from multiple sources. | `data/build_corpus.py` orchestrates loaders for OASST2, SWE-bench Verified, code review, CommitPackFT, Evol-CodeAlpaca, and UltraChat. | UTK should diversify eval scenarios beyond shell output: debug logs, reviews, refactors, structured QA. |
| Integrity filtering | Drops rows that violate fidelity constraints. | `data/filter.py` rejects empty rows, duplicates, out-of-band compression, mutated code fences, high article density, and overlong chat-template length. | Directly relevant. UTK serializers/detok paths need hard filters for protected spans, exact diagnostics, and schema drift. |
| Category-specific compression bands | Prevents the training set from accepting expansion or unusably terse output. | Compression bands differ for `qa`, `review`, `debug`, `refactor`, and `dialogue`; current upper bounds are 1.0 after loosening. | UTK metrics should keep scenario-specific thresholds instead of one global compression number. |
| Code-fence preservation | Treats code block mutation as a hard failure. | Regex extracts fenced code and verifies each source fence appears in the target; dialogue rows also preserve user turns. | Strong UTK rule: code, patches, commands, paths, ids, and exact errors must survive compression. |
| Article density metric | Measures how much filler/style residue remains. | `eval/metrics.py` counts article and copula words against total words. | UTK summaries can track filler density for optional prose compression, but schema facts matter more. |
| Semantic similarity metric | Checks whether meaning survives. | Optional `sentence-transformers/all-MiniLM-L6-v2` embeddings compare source and target. | Useful as an auxiliary eval, never sufficient alone for exact tool-output facts. |
| Workflow eval prompts | Smoke-tests open-ended technical answers. | `eval/workflow_prompts.jsonl` has hand-curated workflow prompts; `run_eval.py` marks compression against prompt as info-only. | UTK should distinguish scored parity fixtures from smoke signals with no gold answer. |
| Category gates | Fails eval on metric regressions by category. | `eval/run_eval.py` defines per-category gates for compression, article density, code-fence match, and semantic similarity. | UTK's RTK parity metrics already follow this spirit; keep failures scenario-named and actionable. |
| QLoRA training | Fine-tunes a large model cheaply on a single GPU host. | `training/train_unsloth.py` uses Unsloth, TRL SFTTrainer, NF4 4-bit loading, rank-16 LoRA, all-linear targets, bf16, cosine LR, completion-only loss, and no packing. | Research only. UTK should not require training to provide value. |
| Training config as source of truth | Keeps hyperparams reviewable. | `training/config.toml` owns model, LoRA, data, and train settings. | Mirrors UTK's `.utk/config.toml`: explicit config beats hidden prompt state. |
| Reproducible publish path | Pushes adapter and merged model artifacts to Hugging Face. | `scripts/push_to_hub.py` and README reproduction steps cover eval and hub upload. | Not a UTK runtime concern, but release artifacts should be traceable to eval outputs. |
| Explicit limitations | Admits compression is weaker than gold and review coverage is sparse. | README lists model ratios of 0.6-0.9 versus gold 0.3-0.5, sparse review pairs, workflow smoke limits, and unverified multimodal behavior. | Good documentation pattern. UTK should document weak scenarios instead of hiding them behind aggregate savings. |

## Implementation Mechanics

### Data Pipeline

The pipeline is a sequence of JSONL transformations:

1. `data/build_corpus.py` pulls records from six source loaders and writes
   `corpus_raw.jsonl`.
2. `data/synthesize.py` creates aligned `{source, target}` pairs. Rows with
   `source_normal` get one Caveman rewrite. Rows with only `source_seed` first
   get normalized into a verbose technical narrative, then rewritten.
3. `data/filter.py` enforces fidelity and compression filters, producing
   `clean_pairs.jsonl` plus rejected rows.
4. `data/split.py` creates train/eval splits.
5. `training/train_unsloth.py` trains a LoRA adapter.
6. `eval/run_eval.py` generates holdout and workflow predictions and checks
   metrics.
7. `scripts/push_to_hub.py` publishes adapter/model artifacts.

Every long-running stage is designed for resumability. This matters because the
synthesis stage shells out to agent CLIs and can hit rate limits or quota caps.

### Synthesis Prompting

The synthesis script uses a strict rewrite instruction:

- keep fenced code byte-exact;
- keep error strings, API names, function names, and CLI commands exact;
- drop articles, filler, pleasantries, and hedging;
- preserve technical meaning;
- only rewrite assistant turns in dialogue-shaped records.

The canonical Caveman skill text is appended as the ruleset. This is a useful
pattern for UTK's generated schemas and route templates: the model can help
produce compact forms, but the rules must be readable and versioned.

### Filtering And Metrics

The filter and eval scripts define the quality contract:

- `compression_ratio = target_tokens / source_tokens`;
- `article_density = selected article/copula terms / word count`;
- `code_fence_exact_match = fraction of source fences appearing in target`;
- `semantic_sim = MiniLM embedding similarity`.

Training filters allow broad compression bands so the model sees enough
examples, while eval gates are stricter and category-specific. UTK should keep a
similar separation between "data accepted for exploration" and "CI gate passed."

### Training

Training is QLoRA SFT:

- base model: `google/gemma-4-31B-it`;
- max sequence length: 4096;
- 4-bit NF4 with double quantization;
- LoRA rank 16, alpha 32, dropout 0;
- target modules: all major linear projections;
- effective batch size 16;
- 3 epochs, cosine learning rate schedule, learning rate 2e-4;
- `completion_only_loss=True`;
- `packing=false`, explicitly because samples may contain code.

The repo includes practical notes for Gemma 4 processor unwrapping, Unsloth
logits behavior, TRL API changes, and Hugging Face upload pitfalls.

### Evaluation

The README reports a 193-pair holdout with these category means:

| Category | n | Compression | Article density | Code fence | Semantic sim |
|---|---:|---:|---:|---:|---:|
| dialogue | 28 | 0.59 | 0.020 | 1.000 | 0.91 |
| debug | 34 | 0.92 | 0.009 | 0.995 | 0.98 |
| refactor | 27 | 0.92 | 0.005 | 0.963 | 0.98 |
| qa | 104 | 0.65 | 0.007 | 1.000 | 0.92 |

The strongest result is preservation: code fences and semantic similarity are
high. The weakest result is compression: debug/refactor outputs are close to
the original token count, and the README explicitly says the model is weaker
than gold Caveman pairs.

## Competitive Implications For UTK

CaveGemma competes most directly with any UTK feature that tries to compress
assistant prose or post-process model-visible text. It does not compete with
UTK's core hook-mediated tool-output path.

Where CaveGemma is strong:

- no prompt/tool/skill overhead once the model is loaded;
- terse answer style survives across agents and hosts;
- evals explicitly track code preservation and semantic retention;
- LoRA artifact is portable to systems that support the base model.

Where UTK can stay stronger:

- deterministic shell and non-shell tool mediation;
- raw artifact persistence and exact recovery;
- schema inference and route confidence;
- pluggable serializers such as TOON and compressed JSON;
- no large model download or GPU requirement;
- CI-backed RTK parity metrics with fact retention and recoverability.

## Competitive Opportunities For UTK

1. Add CaveGemma-style protected-span metrics to detok and serializer tests:
   code fences, CLI commands, paths, error strings, JSON keys, ids, and patches.
2. Report category-specific compression targets instead of one global savings
   number. `git diff`, `vitest`, non-shell JSON, logs, markdown, and prompts
   should have different acceptable ranges.
3. Keep optional prose compression separate from canonical schema facts. A
   CaveGemma-like summarizer can rewrite summaries, but the raw artifact and
   structured route remain source of truth.
4. Add an eval track for "style-only compression versus UTK mediation" so docs
   can show why prompt/model terseness is insufficient for large tool payloads.
5. Borrow the filter pipeline's rejection taxonomy: out-of-band compression,
   protected span mutation, duplicate, too long, semantic drift, and malformed
   output.
6. Use training/eval reproducibility language in UTK docs: exact fixture source,
   metric formula, threshold, and known limitation per scenario.
7. Consider optional local model providers only as plugins. UTK should not make
   heavy weights part of the default install path.

## Risks And Non-Goals

- Do not make UTK depend on CaveGemma, Gemma, Unsloth, PEFT, TRL, or GPU
  infrastructure.
- Do not replace schema validation with semantic similarity. Similar sentences
  can still lose the one exact fact a tool output needed.
- Do not treat lower article density as equivalent to token optimization for
  structured data. For JSON, diffs, logs, and test output, structure-aware
  routing matters more.
- Do not train a model as a shortcut around deterministic serializers.
- Do not let optional model-side style compression mutate raw artifacts,
  patches, commands, paths, or exact diagnostics.

## Source Files Reviewed

- `README.md`
- `AGENTS.md`
- `pyproject.toml`
- `training/config.toml`
- `training/train_unsloth.py`
- `training/runpod_bootstrap.sh`
- `data/build_corpus.py`
- `data/synthesize.py`
- `data/filter.py`
- `data/split.py`
- `data/sources/oasst2.py`
- `data/sources/swe_bench.py`
- `data/sources/codereview.py`
- `data/sources/commitpack.py`
- `data/sources/evol_codealpaca.py`
- `data/sources/ultrachat.py`
- `eval/metrics.py`
- `eval/run_eval.py`
- `eval/judge.py`
- `eval/workflow_prompts.jsonl`
- `scripts/infer.py`
- `scripts/push_to_hub.py`
- `data/seeds/skill_md.md`
- `data/seeds/caveman_README.md`
- `data/seeds/caveman_results.json`

## External Sources

- CaveGemma repository: https://github.com/JuliusBrussee/cavegemma
- Merged model artifact: https://huggingface.co/JBrussee/gemma-4-31B-caveman
- LoRA adapter artifact: https://huggingface.co/JBrussee/gemma-4-31B-caveman-lora
- Caveman source ruleset: https://github.com/JuliusBrussee/caveman
- Caveman skill source: https://github.com/JuliusBrussee/caveman/blob/main/skills/caveman/SKILL.md
- Gemma terms: https://ai.google.dev/gemma/terms
- Unsloth documentation: https://unsloth.ai/docs
- TRL documentation: https://huggingface.co/docs/trl
