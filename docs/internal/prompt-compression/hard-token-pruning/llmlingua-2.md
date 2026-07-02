# LLMLingua-2 Competitive Research

Internal note. Do not link from the public README.

Research date: 2026-07-02
Layer: Prompt compression → hard token pruning (task-agnostic)
Primary source: arXiv **2403.12968** — *LLMLingua-2: Data Distillation for Efficient and Faithful Task-Agnostic Prompt Compression*
Repo: [`microsoft/LLMLingua`](https://github.com/microsoft/LLMLingua), MIT (same monorepo)
Verification: ✅ claimed ID correct (v1 2024-03-19). **Venue: Findings of ACL 2024.**
Lead authors Zhuoshi Pan, Qianhui Wu, Huiqiang Jiang et al. (Microsoft). Released
compressors: `llmlingua-2-xlm-roberta-large-meetingbank`,
`llmlingua-2-bert-base-multilingual-cased-meetingbank`.

## Positioning

The **fast, task-agnostic** LLMLingua — reframes compression as **token classification**
and drops the slow iterative perplexity pass. The best structural fit in this folder
for a hook-based reducer.

## Mechanism

**Distill keep/drop labels from GPT-4** (from MeetingBank) to build an extractive
compression dataset, then train a **Transformer encoder** (**XLM-RoBERTa-large /
mBERT**) as a **bidirectional token classifier** (keep-or-drop per token). A single
encoder forward pass replaces the iterative causal-LM perplexity scoring — much faster
and uses full bidirectional context. (GPT-4 is named in the body/repo; the abstract
just says "an LLM.")

## Verified Metrics

Authors' own: **3×–6× faster** than prior prompt-compression methods (LLMLingua /
LongLLMLingua); end-to-end latency **1.6×–2.9×** at **2×–5×** compression. Evaluated on
**MeetingBank** (in-domain) plus **LongBench, ZeroSCROLLS, GSM8K, BBH** (out-of-domain).

## Scope

**TOKEN-REDUCTION (prompt/input), task-agnostic / query-independent** — so it can
pre-compress and **cache**. Black-box target (no model-side support); needs the local
encoder.

## UTK Relevance

**Structural front-runner** for a UTK-hosted context compressor: fast (single pass),
**query-independent → cacheable**, small model (**300–560M**), permissive **MIT**, and
it emits **text** (recoverable-friendly). The one caveat that matters most: it is
trained on **MeetingBank (meeting transcripts)**, so **generalization to code / agent
context is unproven** and is the exact thing UTK should benchmark before adopting.

## Caveats

- Extractive-only; trained on **meeting-transcript** data — **code/agent-context
  generalization is the open risk**.
- "Drop-in" for the end user (pretrained compressors shipped), but still runs a local
  ~300–560M encoder — not a zero-dependency wrapper.
- Numbers are authors' own; gated by the CAVEWOMAN input caveat.
