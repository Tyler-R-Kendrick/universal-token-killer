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
- `autoevalsFactScore`
- `recoverabilityScore`

## CLI Win Criteria

For RTK-supported CLI scenarios, UTK must be strictly better:

```text
utkCompactTokens < rtkBaselineTokens
factRetentionScore === 1
autoevalsFactScore === 1
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
| `shell-npm-audit` | 5 | 18 | +13 | 0.28 |
| `shell-pytest-failure` | 5 | 21 | +16 | 0.24 |
| `shell-docker-ps` | 5 | 13 | +8 | 0.38 |
| `shell-kubectl-pods` | 5 | 18 | +13 | 0.28 |
| `shell-curl-headers` | 5 | 16 | +11 | 0.31 |
| `shell-du-sizes` | 5 | 13 | +8 | 0.38 |
| `shell-rg-json-lines` | 5 | 19 | +14 | 0.26 |
| `shell-git-log-oneline` | 5 | 20 | +15 | 0.25 |
| `shell-terraform-plan` | 5 | 18 | +13 | 0.28 |
| `shell-helm-status` | 5 | 21 | +16 | 0.24 |
| `shell-ps-memory` | 5 | 17 | +12 | 0.29 |
| `shell-netstat-listen` | 5 | 23 | +18 | 0.22 |
| `shell-openssl-cert` | 5 | 23 | +18 | 0.22 |
| `shell-pnpm-install` | 5 | 20 | +15 | 0.25 |
| `shell-go-test-race` | 5 | 21 | +16 | 0.24 |
| `shell-cargo-test` | 5 | 21 | +16 | 0.24 |
| `shell-dotnet-test` | 5 | 23 | +18 | 0.22 |
| `shell-powershell-error` | 5 | 25 | +20 | 0.20 |
| `shell-azure-deployment` | 5 | 27 | +22 | 0.19 |
| `shell-ffmpeg-progress` | 5 | 16 | +11 | 0.31 |
| `shell-mysql-explain` | 5 | 22 | +17 | 0.23 |
| `shell-windows-dir` | 5 | 20 | +15 | 0.25 |
| `shell-jq-filter` | 5 | 16 | +11 | 0.31 |

## Generalized Tool Scenarios

Non-shell and generalized structured outputs do not have direct RTK equivalents. They are evaluated against raw-output savings:

```text
utkCompactTokens <= rawTokens * 0.35
factRetentionScore === 1
autoevalsFactScore === 1
recoverabilityScore === 1
```

Current generated report: [internal RTK parity benchmark results](internal/rtk-parity-benchmark-results.md).

RTK is one row in the broader benchmark matrix. See [internal benchmark summary](internal/benchmark-summary.md) for RTK, Caveman, Compresr, and LeanCTX Copilot comparisons.

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

The measured CLI ratios range from `0.19` to `0.50`, meaning the current compact artifacts use 19-50% of the checked-in RTK baseline token counts for the same class of shell output. Across all RTK-supported shell fixtures, average UTK/RTK token ratio is `0.271` and estimated savings are `417` tokens.
