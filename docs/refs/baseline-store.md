# Reference: Baseline Store

Baselines turn `@utk/evals` into a TDD harness: every prompt / template / schema / grammar change is gated by a per-metric scorecard diff against a frozen baseline. The store APIs live in `packages/evals/baselines/baselineStore.ts` and are re-exported from `@utk/evals`.

## File Layout

```
packages/evals/baselines/<eval-set-id>.json
```

The on-disk file is the canonical agentevals scorecard shape (see [agentevals-spec.md](agentevals-spec.md) §4) serialized with `JSON.stringify(_, null, 2)` for readability and PR-friendly diffs.

## API

```ts
readBaseline(workspaceRoot, evalSetId, opts?): Promise<Scorecard | null>
writeBaseline(workspaceRoot, evalSetId, scorecard, opts?): Promise<string>
diffScorecards(baseline, current, tolerance = 0.01): BaselineDiff
```

### `readBaseline`

- Returns `null` when the baseline file does not exist or fails to parse.
- `opts.baselineDir`: override the directory (absolute or workspace-relative); defaults to `packages/evals/baselines`.

### `writeBaseline`

- **Refuses to write** unless `opts.force === true` or `process.env.UTK_BASELINE_UPDATE === '1'`. Prevents incidental overwrites from `npm test`.
- Returns the absolute path that was written.
- Creates parent directories as needed.

### `diffScorecards`

```ts
type BaselineDiff = {
  ok: boolean;          // true when no regressions and no missing baselines
  changes: Array<{
    evalId: string;
    metric: string;
    baseline: number | undefined;
    current: number | undefined;
    delta: number;       // current − baseline (or current itself when baseline missing)
    severity: 'regression' | 'improvement' | 'unchanged' | 'missing';
  }>;
};
```

Severity rules:

| Condition | Severity | `ok` impact |
| --- | --- | --- |
| metric in current, not in baseline | `missing` | sets `ok = false` |
| metric in baseline, **not in current** | `regression` | sets `ok = false` — dropping a metric or eval case is treated as a regression |
| `delta < -tolerance` | `regression` | sets `ok = false` |
| `delta > tolerance` | `improvement` | no impact |
| otherwise | `unchanged` | no impact |

The diff iterates the **union** of `(evalId, metric)` pairs from baseline and current, so removed metrics or removed eval cases cannot silently slip past the gate.

`tolerance` defaults to `0.01`. Use `0` when scoring against booleans (`0` / `1`); use `0.05` or higher when stochastic models are in the loop.

## TDD Workflow

```bash
# 1. Run the harness — produces a scorecard and diffs against baseline.
npx vitest run packages/evals/evals/agentevals-harness.test.ts

# 2. Inspect regressions. If they are intentional (intended improvement, new metric),
#    update the baseline:
UTK_BASELINE_UPDATE=1 npx vitest run packages/evals/evals/agentevals-harness.test.ts

# 3. Commit the regenerated baseline alongside the prompt/template/schema/grammar change.
git add packages/evals/baselines/
git commit -m "evals: update baselines after intentional regression"
```

## Regression Demo

`packages/evals/evals/agentevals-harness.test.ts → 'regression-demo end-to-end'` is a self-contained demonstration: a baseline scorecard passes, a mutated trajectory (one tool call dropped) is detected as a regression with the expected per-metric diff. Use it as the reference pattern when authoring new TDD eval suites.
