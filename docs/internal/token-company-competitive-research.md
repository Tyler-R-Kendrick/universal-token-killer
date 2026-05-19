# The Token Company Competitive Research

Internal note. Do not link this document from the public README unless the
competitive strategy becomes intentionally public.

Research date: 2026-05-19
Primary website: https://thetokencompany.com/
Docs: https://thetokencompany.com/docs
Python SDK repository: https://github.com/TheTokenCompany/tokenc-python-sdk
Observed Python SDK revision: `7327cef05950c155c76bba209b90f5da4055f430`
npm SDK repository: https://github.com/TheTokenCompany/tokenc-npm-sdk
Observed npm SDK revision: `0de1142c812155551caa0baaf2ff8758136e3269`
Benchmarks repository: https://github.com/TheTokenCompany/Benchmarks
Observed Benchmarks revision: `92718045281e203a8c21e46bff8a65e41c6e117d`

## Install And Configuration Status

The Token Company was researched from public docs, website pages, and temporary
clones only. It was not installed or configured in this workspace.

Documented install paths:

```powershell
pip install tokenc
npm install tokenc
```

Documented API shape:

```http
POST https://api.thetokencompany.com/v1/compress
Authorization: Bearer <api-key>
Content-Type: application/json
Content-Encoding: gzip
```

```json
{
  "model": "bear-1.2",
  "input": "Your long text to compress",
  "compression_settings": {
    "aggressiveness": 0.1
  }
}
```

Important caveat: The Token Company is a hosted API-first compression product.
The SDKs send prompt/context text to `api.thetokencompany.com`. They document a
zero-data-retention option, but prompts and outputs are still processed by a
remote service and may be temporarily cached for request serving. This is
fundamentally different from UTK's local-first `.utk/` artifact and LLMLingua
detok direction.

## Core Positioning

The Token Company positions Bear as a fast ML-based input-compression model for
LLM context bloat. The product is meant to sit before OpenAI, Anthropic,
OpenRouter, or other providers and return a shorter prompt with similar or
better downstream quality.

This differs from UTK's intended center:

- The Token Company compresses natural-language prompt/document/chat context
  through a hosted API.
- UTK mediates GitHub Copilot tool calls, persists raw outputs, infers schemas,
  routes outputs, and returns compact serialized responses with recovery
  artifacts.
- Bear is model/API middleware. UTK is hook-first, non-CLI, non-proxy, and
  project-local by default.

The overlap worth studying is Bear's preservation controls and proof strategy:
compression aggressiveness, protected spans, gzip transport, token metrics, and
public benchmark harnesses that compare quality and savings against raw input.

## Capability Inventory

| Capability | What it does | How The Token Company implements it | UTK relevance |
|---|---|---|---|
| Bear compression models | Compress input before it reaches a target LLM. | Hosted models `bear-1`, `bear-1.1`, and recommended `bear-1.2` remove low-signal tokens from prompts. | Competitive baseline for prompt/input compression, not structured tool serialization. |
| One-call API | Sends text in and receives compressed text plus token counts. | `POST /v1/compress` takes `model`, `input`, and `compression_settings`; response includes `output`, `original_input_tokens`, and `output_tokens`. | UTK providers should expose similarly direct metrics for every mediation result. |
| Aggressiveness control | Tunes compression intensity. | `compression_settings.aggressiveness` ranges from 0.0 to 1.0 in docs; SDK validation uses exclusive 0 to 1. | UTK TOML should support comparable policy knobs, but with hard fact-retention gates. |
| Min/max output tokens | Bounds compressed output length. | SDK types expose `min_output_tokens` and `max_output_tokens` / `minOutputTokens` and `maxOutputTokens`. | Useful for UTK summaries and fallback envelopes when exact serializer output is too large. |
| Protected text tags | Prevents selected spans from being compressed. | Experimental `<ttc_safe>...</ttc_safe>` tags preserve content such as chat role labels. | Directly relevant to UTK's protected-field policy for paths, commands, ids, diffs, patches, and schemas. |
| JSON protection | Avoids compressing JSON objects. | Python docs expose `protect_json`; current npm type surface does not show this option. | UTK should go beyond coarse JSON protection by using schema-aware TOON/compressed JSON. |
| Gzip request transport | Reduces upload latency for large requests. | SDKs set `Content-Encoding: gzip` and gzip request bodies by default; docs recommend gzip for every request. | UTK can use gzip for optional remote providers, but local hook output still needs deterministic compact text. |
| Token savings metrics | Reports compression effectiveness. | SDK responses compute tokens saved, compression ratio, compression percentage, and compression time. | UTK runtime stats should keep raw tokens, compact tokens, serialized artifact tokens, fact retention, and recoverability. |
| Provider-agnostic examples | Shows Bear before OpenAI, Claude, and OpenRouter. | Docs compress input first, then send `compressed_text` to the downstream LLM provider. | UTK should avoid whole-provider proxying but can benchmark "pre-LLM context cleaner" scenarios. |
| Python SDK | Simple API client for Python users. | `TokenClient.compress_input()` uses a persistent `requests.Session`, gzip, API error classes, and context manager close support. | Good reference for a minimal provider adapter, if UTK ever adds optional Bear provider integration. |
| npm SDK | Type-safe Node client. | `TokenClient.compressInput()` uses `fetch`, `AbortController`, gzip, and typed response helpers; package claims zero dependencies. | Useful shape for internal provider interface, but UTK should not expose this as a public CLI. |
| Error taxonomy | Gives clear API failures. | Both SDKs distinguish authentication, payment, request-too-large, rate-limit, invalid request, timeout, and server/API errors. | UTK should surface explicit provider-unavailable/fail-open reasons in hooks and tests. |
| Zero data retention option | Lets users request no prompt/output persistence. | Docs say prompts/outputs are not stored in any database when enabled, while minimal metadata remains. | Privacy-sensitive users still need UTK's local-first default; remote provider use must be explicit opt-in. |
| Temporary cache | Keeps data only transiently for serving. | Data-retention docs mention temporary memory/disk processing and a 3600-second cache window. | UTK should not depend on remote transient recovery; `.utk/` artifacts should be durable and local. |
| Public benchmark repo | Measures quality and savings across datasets. | Benchmarks compare raw control vs Bear model/aggressiveness configs on FinanceBench, LongBench v2, SQuAD v2, and CoQA. | Strong precedent. UTK should keep CI fixture-backed RTK metrics and add Bear-like semantic-quality evals. |
| LLM-as-judge evals | Scores free-text benchmark answers. | FinanceBench, SQuAD v2, and CoQA use judge prompts; LongBench v2 uses regex extraction for multiple choice. | UTK should pair deterministic required-fact checks with optional LLM judges for semantic summaries. |
| Customer case studies | Claims real production preference and cost wins. | Pax Historia arena case, Helonic construction-drawing case, FinanceBench, latency, SQuAD, and CoQA pages. | Useful competitive framing, but UTK needs reproducible local evals rather than relying on case-study claims. |

## Implementation Mechanics

### API And SDKs

The public API is intentionally small: one compression endpoint, Bear model
selection, input text, and compression settings. The response returns compressed
text and token counts. The Python and npm SDKs add:

- gzip-compressed request bodies by default;
- request timeout handling;
- typed compression settings;
- token-savings helper properties;
- explicit API error classes;
- persistent HTTP session/client reuse.

The current SDKs are thin wrappers over the hosted API. There is no visible
local compression model, schema router, or artifact persistence in the public
SDKs.

### Preservation Controls

The product's main preservation mechanisms are:

- low aggressiveness for conservative compression;
- `min_output_tokens` and `max_output_tokens`;
- `<ttc_safe>` tags for exact spans;
- `protect_json` in the Python-facing docs.

This is important but coarse. UTK should treat protected spans as a baseline
safety feature and then exceed it with structured parsing, schema inference,
serializer validation, and required-fact retention tests.

### Benchmarks

The benchmark repo is the strongest implementation reference. It evaluates
control prompts against generated `bear_model × aggressiveness` configs. Shared
config names:

- `bear_api_url`: `https://api.thetokencompany.com/v1/compress`;
- `bear_models`: `bear-1.2`, `bear-1.1`;
- `aggressiveness_levels`: `0.05`, `0.1`, `0.3`, `0.4`, `0.5`, `0.7`;
- target LLM and judge model: `gpt-5-mini` in the inspected config.

Each benchmark writes JSON results per config and supports resume by skipping
completed questions. FinanceBench compresses SEC-filing context, sends either
raw or compressed context to the LLM, then uses an LLM judge that checks numeric
and factual equivalence. The shared `compress.py` wrapper has retry logic and
caps a reported `output_tokens > original_input_tokens` case as an API bug.

For UTK, this suggests two useful additions:

1. semantic-quality evals for compressed summaries in addition to deterministic
   artifact/fact tests;
2. defensive metric handling when third-party token counts are inconsistent.

### Public Claims And Case Studies

The site and case studies claim:

- Bear-1.2 removes low-signal prompt tokens before LLM inference;
- Bear compression is deterministic and low latency;
- 100K-token compression can run in under roughly 100 ms;
- public benchmark pages show accuracy improvements on financial QA, SQuAD,
  and LongBench-style workloads;
- Pax Historia observed preference and purchase lift in a blind arena/A/B
  scenario;
- Helonic used conservative compression on near-million-token construction
  analysis prompts.

Treat these as competitive claims, not UTK proof. They are useful scenario
ideas for eval design, especially long documents, noisy OCR, repeated chat
history, and user preference studies.

## Competitive Opportunities For UTK

1. Win on structured tool outputs. Bear compresses prompt text; UTK should
   preserve schemas, facts, paths, ids, errors, and rows through deterministic
   serializers before any semantic compression.
2. Make local recoverability the differentiator. Bear returns compressed text;
   UTK returns compact text plus `.utk/` raw and serialized artifact paths.
3. Add Bear-style protected span syntax internally for optional text providers,
   but generate it from UTK policy instead of asking users to hand-tag every
   command/path/schema.
4. Add benchmark scenarios inspired by Bear's public repo: FinanceBench-like
   numeric extraction, SQuAD-like answerability, CoQA-like chat history, and
   long noisy OCR/log contexts.
5. Keep optional remote compression behind explicit TOML. The default UTK path
   should remain TOON/compressed JSON/LLMLingua local, not hosted API calls.
6. Use Bear-style token metrics but expand them: raw tool tokens, compact
   response tokens, serialized artifact tokens, route confidence, required-fact
   retention, recoverability, and repeated-output stability.
7. Add provider error taxonomy in hook output and tests. Authentication,
   rate-limit, timeout, request-too-large, and unavailable should fail open with
   explicit status.
8. Consider gzip for optional remote providers or huge artifact uploads, but do
   not confuse transport gzip with LLM-token compression.
9. Test against aggressive-compression failure modes. Bear's own accuracy page
   shows too much compression can degrade quality; UTK should enforce hard
   floors for fact retention and artifact recovery.
10. Market UTK's narrower but stronger claim: Copilot tool-call optimization
   with durable artifacts, not general hosted prompt compression.

## Risks To Avoid

- Do not send tool outputs or source artifacts to a hosted compressor by
  default.
- Do not treat semantic prompt compression as a substitute for schema routing,
  constrained decoding, TOON, or compressed JSON.
- Do not compress JSON/tool outputs as unstructured text unless policy
  explicitly chooses that fallback.
- Do not accept token savings without required-fact retention and
  recoverability metrics.
- Do not become a public SDK/CLI wrapper around Bear. UTK remains hook-first.
- Do not rely on third-party token counts without sanity checks.

## Source Files And Pages Reviewed

Public web pages:

- https://thetokencompany.com/
- https://thetokencompany.com/docs
- https://thetokencompany.com/docs/examples
- https://thetokencompany.com/docs/gzip
- https://thetokencompany.com/docs/protect-text
- https://thetokencompany.com/docs/python-sdk
- https://thetokencompany.com/docs/npm-sdk
- https://thetokencompany.com/docs/data-retention
- https://thetokencompany.com/benchmarks/accuracy
- https://thetokencompany.com/benchmarks/financebench
- https://thetokencompany.com/benchmarks/latency
- https://thetokencompany.com/benchmarks/squad-v2
- https://thetokencompany.com/benchmarks/coqa
- https://thetokencompany.com/blog/pax-historia
- https://thetokencompany.com/blog/helonic
- https://www.ycombinator.com/companies/the-token-company

Temporary clone files:

- `tokenc-python-sdk/README.md`
- `tokenc-python-sdk/tokenc/client.py`
- `tokenc-python-sdk/tokenc/types.py`
- `tokenc-python-sdk/tokenc/errors.py`
- `tokenc-python-sdk/examples/basic_usage.py`
- `tokenc-python-sdk/examples/advanced_usage.py`
- `tokenc-npm-sdk/README.md`
- `tokenc-npm-sdk/src/client.ts`
- `tokenc-npm-sdk/src/types.ts`
- `tokenc-npm-sdk/src/errors.ts`
- `tokenc-npm-sdk/src/client.test.ts`
- `tokenc-npm-sdk/examples/basic-usage.ts`
- `tokenc-npm-sdk/examples/advanced-usage.ts`
- `Benchmarks/README.md`
- `Benchmarks/config.yaml`
- `Benchmarks/compress.py`
- `Benchmarks/financebench/run_benchmark.py`
- `Benchmarks/financebench/evaluate.py`
- `Benchmarks/longbench_v2/run_benchmark.py`
- `Benchmarks/squad_v2/run_benchmark.py`
- `Benchmarks/coqa/run_benchmark.py`
- `Benchmarks/latency/benchmark.py`
