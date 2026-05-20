import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

let savedBaselineUpdate: string | undefined;
afterEach(() => {
  if (savedBaselineUpdate === undefined) delete process.env.UTK_BASELINE_UPDATE;
  else process.env.UTK_BASELINE_UPDATE = savedBaselineUpdate;
  savedBaselineUpdate = undefined;
});
import {
  ALL_EVALUATORS,
  diffScorecards,
  loadUtkTrace,
  noParseFailures,
  noSoftFailures,
  readBaseline,
  responseMatchScore,
  scoreOne,
  toolTrajectoryAvgScore,
  writeBaseline,
  type EvaluatorInput,
  type Invocation,
  type JaegerTraceLike,
  type Scorecard
} from '../index.js';

function buildInvocation(extra?: Partial<Invocation>): Invocation {
  return {
    invocation_id: 'inv-1',
    user_content: { role: 'user', parts: [{ text: 'do the thing' }] },
    final_response: { role: 'model', parts: [{ text: 'done with status: OK' }] },
    intermediate_data: {
      tool_uses: [
        { name: 'git.status', id: 's1', args: { subcommand: 'status' } },
        { name: 'git.diff', id: 's2', args: { subcommand: 'diff' } }
      ],
      tool_responses: [
        { name: 'git.status', id: 's1', response: 'clean' },
        { name: 'git.diff', id: 's2', response: 'no changes' }
      ]
    },
    ...extra
  } as Invocation;
}

function buildTrace(codes: string[]): JaegerTraceLike {
  return {
    data: [
      {
        spans: codes.map((code) => ({
          tags: [{ key: 'utk.failure.code', value: code }],
          logs: []
        }))
      }
    ]
  };
}

describe('toolTrajectoryAvgScore', () => {
  it('returns 1.0 when expected tools match in order with expected args', async () => {
    const result = await toolTrajectoryAvgScore.evaluate({
      protocol_version: '1.0',
      metric_name: 'tool_trajectory_avg_score',
      threshold: 0.9,
      config: {
        expected: {
          'inv-1': [
            { name: 'git.status', args: { subcommand: 'status' } },
            { name: 'git.diff' }
          ]
        }
      },
      invocations: [buildInvocation()]
    });
    expect(result.score).toBe(1);
    expect(result.status).toBe('PASSED');
  });

  it('returns partial credit when a tool is missing', async () => {
    const result = await toolTrajectoryAvgScore.evaluate({
      protocol_version: '1.0',
      metric_name: 'tool_trajectory_avg_score',
      threshold: 0.9,
      config: {
        expected: {
          'inv-1': [{ name: 'git.status' }, { name: 'git.log' }]
        }
      },
      invocations: [buildInvocation()]
    });
    expect(result.score).toBe(0.5);
    expect(result.status).toBe('FAILED');
  });

  it('vacuously passes when no expected tools are configured', async () => {
    const result = await toolTrajectoryAvgScore.evaluate({
      protocol_version: '1.0',
      metric_name: 'tool_trajectory_avg_score',
      threshold: 1,
      config: {},
      invocations: [buildInvocation()]
    });
    expect(result.score).toBe(1);
  });

  it('returns 0 with no invocations', async () => {
    const result = await toolTrajectoryAvgScore.evaluate({
      protocol_version: '1.0',
      metric_name: 'tool_trajectory_avg_score',
      threshold: 0.5,
      config: {},
      invocations: []
    });
    expect(result.score).toBe(0);
    expect(result.status).toBe('FAILED');
  });

  it('rejects mismatched argument values', () => {
    expect(
      scoreOne(
        [{ name: 'git.status', args: { subcommand: 'log' } }],
        [{ name: 'git.status', id: 's1', args: { subcommand: 'status' } }]
      )
    ).toBe(0);
  });

  it('treats non-object observed args as empty when matching keys are expected', () => {
    expect(
      scoreOne(
        [{ name: 'tool', args: { k: 'v' } }],
        [{ name: 'tool', id: 's1', args: 'not-an-object' }]
      )
    ).toBe(0);
    expect(
      scoreOne(
        [{ name: 'tool' }],
        [{ name: 'tool', id: 's1', args: undefined }]
      )
    ).toBe(1);
  });

  it('ignores malformed expected config entries', async () => {
    const result = await toolTrajectoryAvgScore.evaluate({
      protocol_version: '1.0',
      metric_name: 'tool_trajectory_avg_score',
      threshold: 0,
      config: { expected: 'not-an-object' },
      invocations: [buildInvocation()]
    });
    expect(result.score).toBe(1);
  });
});

describe('responseMatchScore', () => {
  it('scores substring and regex hits per invocation', async () => {
    const result = await responseMatchScore.evaluate({
      protocol_version: '1.0',
      metric_name: 'response_match_score',
      threshold: 0.5,
      config: {
        expected_substrings: { 'inv-1': ['OK'] },
        expected_patterns: { 'inv-1': ['status:\\s+OK'] }
      },
      invocations: [buildInvocation()]
    });
    expect(result.score).toBe(1);
    expect(result.status).toBe('PASSED');
  });

  it('returns less than 1 when a pattern misses', async () => {
    const result = await responseMatchScore.evaluate({
      protocol_version: '1.0',
      metric_name: 'response_match_score',
      threshold: 0.9,
      config: { expected_substrings: { 'inv-1': ['OK', 'fail'] } },
      invocations: [buildInvocation()]
    });
    expect(result.score).toBe(0.5);
    expect(result.status).toBe('FAILED');
  });

  it('vacuously passes with no expectations', async () => {
    const result = await responseMatchScore.evaluate({
      protocol_version: '1.0',
      metric_name: 'response_match_score',
      threshold: 1,
      config: {},
      invocations: [buildInvocation()]
    });
    expect(result.score).toBe(1);
  });

  it('returns 0 with no invocations', async () => {
    const result = await responseMatchScore.evaluate({
      protocol_version: '1.0',
      metric_name: 'response_match_score',
      threshold: 0.5,
      config: {},
      invocations: []
    });
    expect(result.score).toBe(0);
  });

  it('supports flat array expectations applied to every invocation', async () => {
    const result = await responseMatchScore.evaluate({
      protocol_version: '1.0',
      metric_name: 'response_match_score',
      threshold: 1,
      config: { expected_substrings: ['OK'] },
      invocations: [buildInvocation()]
    });
    expect(result.score).toBe(1);
  });

  it('ignores malformed pattern config entries', async () => {
    const result = await responseMatchScore.evaluate({
      protocol_version: '1.0',
      metric_name: 'response_match_score',
      threshold: 1,
      config: { expected_patterns: 42 as unknown as string[] },
      invocations: [buildInvocation()]
    });
    expect(result.score).toBe(1);
  });

  it('returns empty arrays for non-array per-invocation entries', async () => {
    const result = await responseMatchScore.evaluate({
      protocol_version: '1.0',
      metric_name: 'response_match_score',
      threshold: 1,
      config: { expected_substrings: { 'inv-1': 'oops' as unknown as string[] } },
      invocations: [buildInvocation()]
    });
    expect(result.score).toBe(1);
  });

  it('skips non-string entries in arrays', async () => {
    const result = await responseMatchScore.evaluate({
      protocol_version: '1.0',
      metric_name: 'response_match_score',
      threshold: 1,
      config: { expected_substrings: ['OK', 7 as unknown as string] },
      invocations: [buildInvocation()]
    });
    expect(result.score).toBe(1);
  });

  it('treats malformed regex patterns as misses instead of throwing', async () => {
    const result = await responseMatchScore.evaluate({
      protocol_version: '1.0',
      metric_name: 'response_match_score',
      threshold: 0.9,
      config: { expected_patterns: { 'inv-1': ['([unterminated', 'status:\\s+OK'] } },
      invocations: [buildInvocation()]
    });
    // 1 of 2 patterns matched; the malformed pattern silently counts as a miss
    expect(result.score).toBe(0.5);
    expect(result.status).toBe('FAILED');
  });
});

describe('noParseFailures', () => {
  it('passes when no failure codes appear and the trace is attached', async () => {
    const input: EvaluatorInput = {
      protocol_version: '1.0',
      metric_name: 'no_parse_failures',
      threshold: 1,
      config: { trace: buildTrace([]) },
      invocations: [buildInvocation()]
    };
    const result = await noParseFailures.evaluate(input);
    expect(result.score).toBe(1);
  });

  it('fails when a parse failure code appears', async () => {
    const result = await noParseFailures.evaluate({
      protocol_version: '1.0',
      metric_name: 'no_parse_failures',
      threshold: 1,
      config: { trace: buildTrace(['pack/manifest/parse']) },
      invocations: [buildInvocation()]
    });
    expect(result.score).toBe(0);
    expect(result.status).toBe('FAILED');
    expect(result.details.offending).toContain('pack/manifest/parse');
  });

  it('fails on dot-namespaced parse codes emitted by core (pack.manifest.parse, pack.seed.parse, template.load)', async () => {
    for (const code of ['pack.manifest.parse', 'pack.seed.parse', 'template.load']) {
      const result = await noParseFailures.evaluate({
        protocol_version: '1.0',
        metric_name: 'no_parse_failures',
        threshold: 1,
        config: { trace: buildTrace([code]) },
        invocations: [buildInvocation()]
      });
      expect(result.score, `${code} should fail`).toBe(0);
      expect(result.details.offending).toContain(code);
    }
  });

  it('detects failure codes nested inside log fields', async () => {
    const trace: JaegerTraceLike = {
      data: [
        {
          spans: [
            {
              tags: [],
              logs: [{ fields: [{ key: 'utk.failure.code', value: 'template/load-error' }] }]
            }
          ]
        }
      ]
    };
    const result = await noParseFailures.evaluate({
      protocol_version: '1.0',
      metric_name: 'no_parse_failures',
      threshold: 1,
      config: { trace },
      invocations: []
    });
    expect(result.score).toBe(0);
  });

  it('honors a custom allowlist', async () => {
    const result = await noParseFailures.evaluate({
      protocol_version: '1.0',
      metric_name: 'no_parse_failures',
      threshold: 1,
      config: { trace: buildTrace(['cache.write']), allow: ['cache.'] },
      invocations: [buildInvocation()]
    });
    expect(result.score).toBe(0);
  });

  it('passes vacuously when no trace is attached', async () => {
    const result = await noParseFailures.evaluate({
      protocol_version: '1.0',
      metric_name: 'no_parse_failures',
      threshold: 1,
      config: {},
      invocations: [buildInvocation()]
    });
    expect(result.score).toBe(1);
  });

  it('ignores non-string failure code values', async () => {
    const trace: JaegerTraceLike = {
      data: [
        {
          spans: [
            { tags: [{ key: 'utk.failure.code', value: 42 }, { key: 'other', value: 'ignore' }], logs: [] }
          ]
        }
      ]
    };
    const result = await noParseFailures.evaluate({
      protocol_version: '1.0',
      metric_name: 'no_parse_failures',
      threshold: 1,
      config: { trace },
      invocations: []
    });
    expect(result.score).toBe(1);
  });
});

describe('noSoftFailures', () => {
  it('passes when no soft-failure codes appear', async () => {
    const result = await noSoftFailures.evaluate({
      protocol_version: '1.0',
      metric_name: 'no_soft_failures',
      threshold: 1,
      config: { trace: buildTrace([]) },
      invocations: [buildInvocation()]
    });
    expect(result.score).toBe(1);
  });

  it('fails when a soft-failure code appears', async () => {
    const result = await noSoftFailures.evaluate({
      protocol_version: '1.0',
      metric_name: 'no_soft_failures',
      threshold: 1,
      config: { trace: buildTrace(['cache.write']) },
      invocations: [buildInvocation()]
    });
    expect(result.score).toBe(0);
    expect(result.details.offending).toContain('cache.write');
  });

  it('respects the allow list', async () => {
    const result = await noSoftFailures.evaluate({
      protocol_version: '1.0',
      metric_name: 'no_soft_failures',
      threshold: 1,
      config: { trace: buildTrace(['cache.write']), allow: ['cache.write'] },
      invocations: [buildInvocation()]
    });
    expect(result.score).toBe(1);
  });

  it('detects soft-failure codes recorded as log fields on existing spans (not just span tags)', async () => {
    const trace: JaegerTraceLike = {
      data: [
        {
          spans: [
            {
              tags: [],
              logs: [{ fields: [{ key: 'utk.failure.code', value: 'detok.unavailable' }] }]
            }
          ]
        }
      ]
    };
    const result = await noSoftFailures.evaluate({
      protocol_version: '1.0',
      metric_name: 'no_soft_failures',
      threshold: 1,
      config: { trace },
      invocations: [buildInvocation()]
    });
    expect(result.score).toBe(0);
    expect(result.details.offending).toContain('detok.unavailable');
  });

  it('ignores non-soft codes', async () => {
    const result = await noSoftFailures.evaluate({
      protocol_version: '1.0',
      metric_name: 'no_soft_failures',
      threshold: 1,
      config: { trace: buildTrace(['pack/manifest/parse']) },
      invocations: [buildInvocation()]
    });
    expect(result.score).toBe(1);
  });

  it('ignores non-string failure code values', async () => {
    const trace: JaegerTraceLike = {
      data: [
        {
          spans: [
            { tags: [{ key: 'utk.failure.code', value: 99 }, { key: 'other', value: 'ignore' }], logs: [] }
          ]
        }
      ]
    };
    const result = await noSoftFailures.evaluate({
      protocol_version: '1.0',
      metric_name: 'no_soft_failures',
      threshold: 1,
      config: { trace },
      invocations: []
    });
    expect(result.score).toBe(1);
  });

  it('passes vacuously when no trace is attached', async () => {
    const result = await noSoftFailures.evaluate({
      protocol_version: '1.0',
      metric_name: 'no_soft_failures',
      threshold: 1,
      config: {},
      invocations: [buildInvocation()]
    });
    expect(result.score).toBe(1);
  });
});

describe('ALL_EVALUATORS', () => {
  it('exposes the canonical evaluator set in a stable order', () => {
    expect(ALL_EVALUATORS.map((entry) => entry.metricName)).toEqual([
      'tool_trajectory_avg_score',
      'response_match_score',
      'no_parse_failures',
      'no_soft_failures'
    ]);
    for (const evaluator of ALL_EVALUATORS) {
      expect(evaluator.rubric.length).toBeGreaterThan(0);
      expect(typeof evaluator.description).toBe('string');
    }
  });
});

describe('loadUtkTrace', () => {
  it('reads jaeger and eval-set files from .utk/events', async () => {
    const workspace = await mkdtemp(path.join(os.tmpdir(), 'utk-load-trace-'));
    const eventsDir = path.join(workspace, '.utk', 'events');
    await mkdir(eventsDir, { recursive: true });
    await writeFile(
      path.join(eventsDir, 'run-1.eval_set.json'),
      JSON.stringify({
        eval_set_id: 'run-1',
        name: 'run-1',
        eval_cases: [{ eval_id: 'run-1', conversation: [buildInvocation()] }]
      }),
      'utf8'
    );
    await writeFile(
      path.join(eventsDir, 'run-1.jaeger.json'),
      JSON.stringify({ data: [{ spans: [] }] }),
      'utf8'
    );
    const loaded = await loadUtkTrace(workspace, 'run-1');
    expect(loaded.invocations).toHaveLength(1);
    expect(loaded.evalSet.eval_set_id).toBe('run-1');
  });

  it('honors absolute storageRoot overrides', async () => {
    const workspace = await mkdtemp(path.join(os.tmpdir(), 'utk-load-trace-abs-'));
    await writeFile(
      path.join(workspace, 'run-2.eval_set.json'),
      JSON.stringify({
        eval_set_id: 'run-2',
        name: 'run-2',
        eval_cases: [{ eval_id: 'run-2', conversation: [buildInvocation()] }]
      }),
      'utf8'
    );
    await writeFile(
      path.join(workspace, 'run-2.jaeger.json'),
      JSON.stringify({ data: [{ spans: [] }] }),
      'utf8'
    );
    const loaded = await loadUtkTrace(workspace, 'run-2', { storageRoot: workspace });
    expect(loaded.evalSet.eval_set_id).toBe('run-2');
  });

  it('rejects runIds containing path-traversal segments before any read', async () => {
    const workspace = await mkdtemp(path.join(os.tmpdir(), 'utk-load-trace-traversal-'));
    await expect(loadUtkTrace(workspace, '../escapee')).rejects.toThrow(/Invalid runId/);
    await expect(loadUtkTrace(workspace, 'a/b')).rejects.toThrow(/Invalid runId/);
  });
});

describe('baselineStore', () => {
  const scorecard: Scorecard = {
    eval_set_id: 'demo',
    results: [
      { eval_id: 'demo', overall_score: 1, metrics: { tool_trajectory_avg_score: 1, response_match_score: 0.9 }, status: 'PASSED' }
    ]
  };

  it('returns null when a baseline file does not exist', async () => {
    const workspace = await mkdtemp(path.join(os.tmpdir(), 'utk-baseline-missing-'));
    expect(await readBaseline(workspace, 'demo')).toBeNull();
  });

  it('rejects evalSetIds containing path-traversal segments before any IO', async () => {
    const workspace = await mkdtemp(path.join(os.tmpdir(), 'utk-baseline-traversal-'));
    await expect(readBaseline(workspace, '../escapee')).rejects.toThrow(/Invalid evalSetId/);
    await expect(writeBaseline(workspace, '../escapee', scorecard, { baselineDir: path.join(workspace, 'b'), force: true })).rejects.toThrow(/Invalid evalSetId/);
  });

  it('writes baselines only when force or UTK_BASELINE_UPDATE is set', async () => {
    const workspace = await mkdtemp(path.join(os.tmpdir(), 'utk-baseline-write-'));
    savedBaselineUpdate = process.env.UTK_BASELINE_UPDATE;
    delete process.env.UTK_BASELINE_UPDATE;
    await expect(writeBaseline(workspace, 'demo', scorecard, { baselineDir: path.join(workspace, 'baselines') })).rejects.toThrow(/Refusing/);

    process.env.UTK_BASELINE_UPDATE = '1';
    const filePath = await writeBaseline(workspace, 'demo', scorecard, { baselineDir: path.join(workspace, 'baselines') });
    expect(filePath).toContain('baselines');
    const text = await readFile(filePath, 'utf8');
    expect(text).toContain('"eval_set_id"');

    delete process.env.UTK_BASELINE_UPDATE;

    const fromForce = await writeBaseline(workspace, 'demo', scorecard, { baselineDir: path.join(workspace, 'baselines-force'), force: true });
    expect(fromForce).toContain('baselines-force');
  });

  it('reads baselines that were written via writeBaseline', async () => {
    const workspace = await mkdtemp(path.join(os.tmpdir(), 'utk-baseline-roundtrip-'));
    await writeBaseline(workspace, 'demo', scorecard, { baselineDir: path.join(workspace, 'baselines'), force: true });
    const read = await readBaseline(workspace, 'demo', { baselineDir: path.join(workspace, 'baselines') });
    expect(read?.results[0]?.metrics.tool_trajectory_avg_score).toBe(1);
  });

  it('flags metrics dropped from current relative to baseline as regressions', () => {
    const baseline: Scorecard = {
      eval_set_id: 'demo',
      results: [
        { eval_id: 'demo', overall_score: 1, metrics: { tool_trajectory_avg_score: 1, response_match_score: 0.9 }, status: 'PASSED' }
      ]
    };
    const droppedMetric: Scorecard = {
      eval_set_id: 'demo',
      results: [
        { eval_id: 'demo', overall_score: 1, metrics: { tool_trajectory_avg_score: 1 }, status: 'PASSED' }
      ]
    };
    const diff = diffScorecards(baseline, droppedMetric);
    expect(diff.ok).toBe(false);
    const dropped = diff.changes.find((change) => change.metric === 'response_match_score');
    expect(dropped?.severity).toBe('regression');
    expect(dropped?.current).toBeUndefined();
    expect(dropped?.baseline).toBe(0.9);

    const droppedEvalCase: Scorecard = { eval_set_id: 'demo', results: [] };
    const diff2 = diffScorecards(baseline, droppedEvalCase);
    expect(diff2.ok).toBe(false);
    expect(diff2.changes.every((change) => change.severity === 'regression')).toBe(true);
  });

  it('diffs detect regressions, improvements, unchanged, and missing baselines', () => {
    const diff = diffScorecards(null, scorecard);
    expect(diff.ok).toBe(false);
    expect(diff.changes.every((change) => change.severity === 'missing')).toBe(true);

    const regression: Scorecard = {
      eval_set_id: 'demo',
      results: [
        { eval_id: 'demo', overall_score: 0.5, metrics: { tool_trajectory_avg_score: 0.5, response_match_score: 1, no_parse_failures: 1 }, status: 'FAILED' }
      ]
    };
    const diff2 = diffScorecards(scorecard, regression);
    expect(diff2.ok).toBe(false);
    const severities = new Map(diff2.changes.map((change) => [change.metric, change.severity]));
    expect(severities.get('tool_trajectory_avg_score')).toBe('regression');
    expect(severities.get('response_match_score')).toBe('improvement');
    expect(severities.get('no_parse_failures')).toBe('missing');
    const matching: Scorecard = {
      eval_set_id: 'demo',
      results: [
        { eval_id: 'demo', overall_score: 1, metrics: { tool_trajectory_avg_score: 1, response_match_score: 0.9 }, status: 'PASSED' }
      ]
    };
    const diff3 = diffScorecards(scorecard, matching);
    expect(diff3.ok).toBe(true);
    expect(diff3.changes.every((change) => change.severity === 'unchanged')).toBe(true);
  });
});

describe('regression-demo end-to-end', () => {
  it('passes the baseline trajectory and fails when a tool call is dropped', async () => {
    const baselineCard: Scorecard = {
      eval_set_id: 'regression-demo',
      results: [
        { eval_id: 'regression-demo', overall_score: 1, metrics: { tool_trajectory_avg_score: 1, response_match_score: 1, no_parse_failures: 1, no_soft_failures: 1 }, status: 'PASSED' }
      ]
    };
    const cleanTrace = buildTrace([]);
    const invocations = [buildInvocation()];
    const expected = {
      'inv-1': [
        { name: 'git.status' },
        { name: 'git.diff' }
      ]
    };
    const traj = await toolTrajectoryAvgScore.evaluate({
      protocol_version: '1.0', metric_name: 'tool_trajectory_avg_score', threshold: 1, config: { expected }, invocations
    });
    const resp = await responseMatchScore.evaluate({
      protocol_version: '1.0', metric_name: 'response_match_score', threshold: 1, config: { expected_substrings: { 'inv-1': ['OK'] } }, invocations
    });
    const parse = await noParseFailures.evaluate({
      protocol_version: '1.0', metric_name: 'no_parse_failures', threshold: 1, config: { trace: cleanTrace }, invocations
    });
    const soft = await noSoftFailures.evaluate({
      protocol_version: '1.0', metric_name: 'no_soft_failures', threshold: 1, config: { trace: cleanTrace }, invocations
    });
    const current: Scorecard = {
      eval_set_id: 'regression-demo',
      results: [
        {
          eval_id: 'regression-demo',
          overall_score: (traj.score + resp.score + parse.score + soft.score) / 4,
          metrics: {
            tool_trajectory_avg_score: traj.score,
            response_match_score: resp.score,
            no_parse_failures: parse.score,
            no_soft_failures: soft.score
          },
          status: 'PASSED'
        }
      ]
    };
    expect(diffScorecards(baselineCard, current).ok).toBe(true);

    const mutated: Invocation = {
      ...invocations[0]!,
      intermediate_data: {
        tool_uses: [{ name: 'git.status', id: 's1', args: {} }],
        tool_responses: [{ name: 'git.status', id: 's1', response: 'clean' }]
      }
    };
    const regressedTraj = await toolTrajectoryAvgScore.evaluate({
      protocol_version: '1.0', metric_name: 'tool_trajectory_avg_score', threshold: 1, config: { expected }, invocations: [mutated]
    });
    const regressed: Scorecard = {
      eval_set_id: 'regression-demo',
      results: [
        {
          eval_id: 'regression-demo',
          overall_score: regressedTraj.score,
          metrics: { tool_trajectory_avg_score: regressedTraj.score, response_match_score: 1, no_parse_failures: 1, no_soft_failures: 1 },
          status: 'FAILED'
        }
      ]
    };
    const diff = diffScorecards(baselineCard, regressed);
    expect(diff.ok).toBe(false);
    expect(diff.changes.find((change) => change.metric === 'tool_trajectory_avg_score')?.severity).toBe('regression');
  });
});
