# RTK Parity

UTK tracks RTK parity with fixture-backed tests and optional live RTK benchmarking.

## Required CI Metrics

Each parity scenario measures:

- `rawBytes`, `rawTokens`
- `utkResponseBytes`, `utkResponseTokens`
- `utkCompactBytes`, `utkCompactTokens`
- `rtkBytes`, `rtkTokens`
- `utkVsRtkTokenDelta`, `utkVsRtkTokenRatio`
- `rawToUtkSavingsRatio`
- `factRetentionScore`
- `recoverabilityScore`

## CLI Win Criteria

For RTK-supported CLI scenarios, UTK must be strictly better:

```text
utkCompactTokens < rtkBaselineTokens
factRetentionScore === 1
recoverabilityScore === 1
```

Current measured shell results:

| Scenario | UTK tokens | RTK tokens | Delta | Ratio |
| --- | ---: | ---: | ---: | ---: |
| `shell-git-status` | 5 | 21 | +16 | 0.24 |
| `shell-git-diff` | 5 | 23 | +18 | 0.22 |
| `shell-gh-pr-list` | 6 | 19 | +13 | 0.32 |
| `shell-rg` | 5 | 18 | +13 | 0.28 |
| `shell-vitest` | 5 | 10 | +5 | 0.50 |
| `shell-tsc` | 5 | 21 | +16 | 0.24 |

## Generalized Tool Scenarios

Non-shell and generalized structured outputs do not have direct RTK equivalents. They are evaluated against raw-output savings:

```text
utkCompactTokens <= rawTokens * 0.35
factRetentionScore === 1
recoverabilityScore === 1
```

## Optional Live RTK Benchmark

The internal benchmark runner is optional and skipped unless configured:

```bash
UTK_RTK_COMMAND="rtk" npm test -- scripts/bench-rtk-baseline.test.ts
```

Use `UTK_RTK_COMMAND` or `UTK_RTK_BIN` to compare live RTK output against golden fixture baselines. This is not required by normal CI.

## Reading The Numbers

- `Delta` is `rtkTokens - utkCompactTokens`; higher is better.
- `Ratio` is `utkCompactTokens / rtkTokens`; lower is better.
- A ratio below `1.00` is required for CLI scenarios.
- A passing scenario still has to retain all required facts and keep artifacts recoverable.

The measured CLI ratios range from `0.22` to `0.50`, meaning the current compact artifacts use 22-50% of the checked-in RTK baseline token counts for the same class of shell output.
