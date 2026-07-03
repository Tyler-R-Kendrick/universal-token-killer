# Prompt Compression

Academic and general prompt (input) compression — reduce the tokens of the prompt/context before the call.

## Subcategories

* [Hard Token Pruning](/techniques/prompt-compression/hard-token-pruning/) - Hard prompt compression that deletes low-information tokens while keeping the rest verbatim (the LLMLingua family, Selective Context).
* [RAG & Generative](/techniques/prompt-compression/rag-and-generative/) - Prompt compression by rewriting or compressing retrieved chunks rather than deleting tokens (RECOMP, SCOPE).
* [Soft-Token Compression](/techniques/prompt-compression/soft-token-compression/) - Soft prompt compression into learned special tokens — reference-only for UTK because it needs model-side support (Gist Tokens, 500xCompressor).

## Documents

* [Prompt / Input Compression](/techniques/prompt-compression/overview.md) - Academic and general prompt (input) compression — reduce the tokens of the prompt/context before the call.
