# Ponytail Parity Benchmark Results

Generated from `packages/evals/fixtures/ponytailParityFixtures.ts`.

## Summary

- Emission scenarios: 6
- Mode evaluations: 18 (lite, full, ultra)
- Ladder evaluations: 6
- Outperformed ponytail full baseline: 6/6
- Outperformed ponytail mode baselines: 18/18
- Ladder decisions correct: 6/6
- Average UTK-min/ponytail token ratio: 0.811
- Average UTK-min/verbose token ratio: 0.496
- Total estimated token savings vs ponytail: 141
- Total estimated token savings vs verbose baseline: 610
- Round-trip fidelity / parse validity / min leakage / fact retention: 1.000 all scenarios

## Findings

- Ponytail is strongest at refusing unnecessary code: its ladder and minimal implementations are already terse, so single-shot emissions win by structure, not prose.
- UTK outperforms by changing how the remaining code is written: repeated identifiers become single-token min-ids declared once in a @minmap patch, and shared idioms collapse into macro calls.
- The UTK arm is measured including its @minmap patch overhead — the declared pretty names are paid once, so savings concentrate where identifiers repeat and grow when a session reuses the map across emissions.
- Users only ever see the deterministic pretty expansion; every scenario gates on round-trip fidelity, parse validity, min leakage, and fact retention at 1.0 — token wins do not count when a gate drops.
- All arms are measured without indentation so deltas reflect symbols and idioms rather than whitespace; token counts use the repo-standard `ceil(chars/4)` estimate.

## Mode Results

| Mode | Cases | Ponytail Tokens | UTK Min Tokens | Delta | Ratio | Quality Gates |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| lite | 6 | 864 | 615 | 249 | 0.712 | 1.000 |
| full | 6 | 756 | 615 | 141 | 0.813 | 1.000 |
| ultra | 6 | 752 | 615 | 137 | 0.818 | 1.000 |

## Ladder Results

| Scenario | Expected Rung | Selected Rung | Strategy | Correct |
| --- | ---: | ---: | --- | ---: |
| ladder-reuse-existing-helper | 2 | 2 | reuse | 1.000 |
| ladder-stdlib-structured-clone | 3 | 3 | stdlib | 1.000 |
| ladder-platform-date-picker | 4 | 4 | platform | 1.000 |
| ladder-dependency-schema-validation | 5 | 5 | dependency | 1.000 |
| ladder-macro-full-mode | 6 | 6 | macro | 1.000 |
| ladder-macro-lite-mode | 7 | 7 | plain | 1.000 |

## Results

| Scenario | Category | Verbose Tokens | Ponytail Tokens | UTK Min Tokens | Delta | Ratio | Quality Gates |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fetch-json-retry | Emission: resilient helper | 276 | 167 | 144 | 23 | 0.862 | 1.000 |
| widget-api-macro-helpers | Emission: macro idioms | 179 | 107 | 73 | 34 | 0.682 | 1.000 |
| service-config-loader | Emission: config parsing | 255 | 178 | 143 | 35 | 0.803 | 1.000 |
| memoize-async-lookup | Emission: caching utility | 174 | 104 | 85 | 19 | 0.817 | 1.000 |
| group-records-by-key | Emission: data shaping | 176 | 107 | 91 | 16 | 0.850 | 1.000 |
| paginate-entries | Emission: pagination utility | 165 | 93 | 79 | 14 | 0.849 | 1.000 |

## Scenario Notes

### fetch-json-retry

- Use case: Emit a retrying JSON fetch helper with timeout handling plus a null-safe wrapper.
- Test strategy: Round-trip fidelity, parse validity, and strict min-token wins over every Ponytail mode arm.
- Ponytail good at: Writes the minimum viable retry loop with no prose and no dependency.
- UTK attempt: Declare repeated identifiers once in a @minmap patch, emit single-token ids at every use.

### widget-api-macro-helpers

- Use case: Emit three JSON API helpers that all share the fetch-then-json idiom.
- Test strategy: Macro-call compression of a repeated idiom with expansion equality against the committed pretty form.
- Ponytail good at: Writes each helper as a compact one-line arrow function.
- UTK attempt: Collapse the shared fetch-then-json idiom into a single-token macro call per helper.

### service-config-loader

- Use case: Emit an environment config loader with validated port and timeout values.
- Test strategy: Identifier-repetition compression with validation carve-outs preserved through expansion.
- Ponytail good at: Reads only the needed environment keys and returns a plain object.
- UTK attempt: Map the five repeated config identifiers to single tokens; keep validation errors verbatim.

### memoize-async-lookup

- Use case: Emit an async memoization wrapper with a shared in-flight cache.
- Test strategy: High identifier reuse across cache reads and writes with exact expansion equality.
- Ponytail good at: Uses a plain Map and returns early on cache hits — no memoization dependency.
- UTK attempt: Five repeated identifiers become single tokens across ten usage sites.

### group-records-by-key

- Use case: Emit a group-by utility that buckets records under a key value.
- Test strategy: Repeated bucket identifiers compressed while the unknown-key fallback string survives verbatim.
- Ponytail good at: Uses a plain object accumulator instead of a collection dependency.
- UTK attempt: Six repeated identifiers become single tokens; the fallback label stays a literal.

### paginate-entries

- Use case: Emit an array pagination helper returning the page slice and total page count.
- Test strategy: Arithmetic identifier reuse compressed with stdlib Math calls left untouched.
- Ponytail good at: Uses Array.slice and Math with no pagination dependency.
- UTK attempt: Seven repeated identifiers become single tokens; Math stays verbatim as a platform anchor.

## Validation Commands

```bash
npm run bench:ponytail --workspace @utk/evals
npm run report:ponytail --workspace @utk/evals
```

## Maintenance Notes

- Keep this report, `docs/internal/benchmark-summary.md`, and `docs/evals.md` in sync per `packages/evals/AGENTS.md`.
- The ponytail arms are hand-authored deterministic baselines modeled on the published Ponytail rung examples; Ponytail itself was not installed (see `docs/internal/ponytail-competitive-research.md`).
