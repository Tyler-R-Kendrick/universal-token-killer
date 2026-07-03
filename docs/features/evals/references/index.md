# References

## Documents

* [Reference: agentevals.io Artifact Spec](/features/evals/references/agentevals-spec.md) - Canonical wire shapes UTK emits and consumes, sourced from github.com/agentevals-dev/agentevals (Apache 2.0, Solo.io governance).
* [Reference: Baseline Store](/features/evals/references/baseline-store.md) - Baselines turn @utk/evals into a TDD harness: every prompt / template / schema / grammar change is gated by a per-metric scorecard diff against a frozen baseline.
* [Reference: Evaluator Config Keys](/features/evals/references/evaluator-config.md) - Every evaluator follows the agentevals.io stdin/stdout JSON protocol (see agentevals-spec.md).
* [Reference: Tracing Failure Codes](/features/evals/references/tracing-failure-codes.md) - Stable identifiers attached as utk.failure.code on Jaeger log entries (and on orphan-span tags when no parent span exists).
