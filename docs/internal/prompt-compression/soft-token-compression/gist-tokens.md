# Gist Tokens Competitive Research

Internal note. Do not link from the public README.

Research date: 2026-07-02
Layer: Prompt compression → soft-token compression
Primary source: arXiv **2304.08467** — *Learning to Compress Prompts with Gist Tokens*
Repo: [`jayelm/gisting`](https://github.com/jayelm/gisting), Apache-2.0 (training data mixes Self-Instruct Apache-2.0 + Stanford Alpaca CC BY-NC 4.0)
Verification: ✅ claimed ID correct (v1 2023-04-17, v3 2024-02). **Venue: NeurIPS 2023.**
Authors Jesse Mu, Xiang Lisa Li, Noah Goodman (Stanford). **Also covered in
[watchlist §9](../../token-optimization-landscape-watchlist.md)** — this file is the
canonical soft-token anchor; the confirmation checks out.

## Positioning

The canonical **learned reusable-prompt compression**: compress a prompt into a few
**cacheable** "gist" tokens, trained essentially for free during instruction tuning.

## Mechanism

Trains the LM to compress a prompt into a few reusable/cacheable **gist tokens** by
**modifying Transformer attention masks** during instruction finetuning — **no extra
training cost** over standard instruction tuning. The gist tokens can then be cached and
reused in place of the full prompt prefix.

## Verified Metrics

Authors' own: "up to **26× compression** of prompts, resulting in up to **40% FLOPs
reductions, 4.2% wall-time speedups**" on **LLaMA-7B** (decoder) and **FLAN-T5-XXL**
(encoder-decoder), "with minimal loss in output quality."

## Scope

**SOFT-TOKEN compression** of the instruction/prompt; **needs model-side support** (the
model is trained to produce/consume gist tokens).

## UTK Relevance

**Reference-only** (as already noted in watchlist §9): it **requires model fine-tuning**
and produces **non-recoverable** gist tokens — incompatible with UTK's training-free,
model-agnostic hook. Its value to UTK is as the theoretical anchor for "reusable
compressed prefix" and as a contrast to UTK's recoverable-text caching (which achieves
prefix reuse via provider prompt caching, no model changes).

## Caveats

- **Requires model fine-tuning** — not a drop-in wrapper.
- Non-recoverable latent tokens.
- Confirmation of the existing watchlist §9 entry; all three claims (NeurIPS 2023 / 26× /
  needs fine-tuning) verified.
