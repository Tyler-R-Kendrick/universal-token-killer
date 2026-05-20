import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Scorecard } from '../evaluators/types.js';

export type BaselineDiff = {
  ok: boolean;
  changes: Array<{
    evalId: string;
    metric: string;
    baseline: number | undefined;
    current: number | undefined;
    delta: number;
    severity: 'regression' | 'improvement' | 'unchanged' | 'missing';
  }>;
};

export type ReadBaselineOptions = { baselineDir?: string };
export type WriteBaselineOptions = { baselineDir?: string; force?: boolean };

const DEFAULT_DIR = 'packages/evals/baselines';

export async function readBaseline(workspaceRoot: string, evalSetId: string, options: ReadBaselineOptions = {}): Promise<Scorecard | null> {
  const filePath = baselineFilePath(workspaceRoot, evalSetId, options.baselineDir);
  try {
    const text = await readFile(filePath, 'utf8');
    return JSON.parse(text) as Scorecard;
  } catch {
    return null;
  }
}

export async function writeBaseline(
  workspaceRoot: string,
  evalSetId: string,
  scorecard: Scorecard,
  options: WriteBaselineOptions = {}
): Promise<string> {
  if (!options.force && process.env.UTK_BASELINE_UPDATE !== '1') {
    throw new Error('Refusing to write baseline without force or UTK_BASELINE_UPDATE=1');
  }
  const filePath = baselineFilePath(workspaceRoot, evalSetId, options.baselineDir);
  await mkdir(path.dirname(filePath), { recursive: true });
  const text = `${JSON.stringify(scorecard, null, 2)}\n`;
  await writeFile(filePath, text, 'utf8');
  return filePath;
}

export function diffScorecards(baseline: Scorecard | null, current: Scorecard, tolerance = 0.01): BaselineDiff {
  const changes: BaselineDiff['changes'] = [];
  if (!baseline) {
    for (const result of current.results) {
      for (const [metric, value] of Object.entries(result.metrics)) {
        changes.push({ evalId: result.eval_id, metric, baseline: undefined, current: value, delta: value, severity: 'missing' });
      }
    }
    return { ok: false, changes };
  }
  const baselineByEval = new Map(baseline.results.map((entry) => [entry.eval_id, entry]));
  const currentByEval = new Map(current.results.map((entry) => [entry.eval_id, entry]));
  const evalIds = new Set([...baselineByEval.keys(), ...currentByEval.keys()]);
  let ok = true;
  for (const evalId of evalIds) {
    const previous = baselineByEval.get(evalId);
    const result = currentByEval.get(evalId);
    const metrics = new Set([
      ...Object.keys(previous?.metrics ?? {}),
      ...Object.keys(result?.metrics ?? {})
    ]);
    for (const metric of metrics) {
      const baselineValue = previous?.metrics[metric];
      const currentValue = result?.metrics[metric];
      let severity: BaselineDiff['changes'][number]['severity'];
      let delta: number;
      if (baselineValue === undefined && currentValue !== undefined) {
        severity = 'missing';
        delta = currentValue;
        ok = false;
      } else if (baselineValue !== undefined && currentValue === undefined) {
        // Metric or eval case present in baseline but dropped from current — treat as a regression.
        severity = 'regression';
        delta = -baselineValue;
        ok = false;
      } else if (baselineValue !== undefined && currentValue !== undefined) {
        delta = currentValue - baselineValue;
        if (delta < -tolerance) {
          severity = 'regression';
          ok = false;
        } else if (delta > tolerance) {
          severity = 'improvement';
        } else {
          severity = 'unchanged';
        }
      } else {
        continue;
      }
      changes.push({ evalId, metric, baseline: baselineValue, current: currentValue, delta, severity });
    }
  }
  return { ok, changes };
}

function baselineFilePath(workspaceRoot: string, evalSetId: string, baselineDir?: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(evalSetId)) {
    throw new Error(`Invalid evalSetId: ${evalSetId} (must match /^[A-Za-z0-9._-]+$/)`);
  }
  const dir = baselineDir ?? DEFAULT_DIR;
  return path.isAbsolute(dir) ? path.join(dir, `${evalSetId}.json`) : path.join(workspaceRoot, dir, `${evalSetId}.json`);
}
