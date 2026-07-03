import type { Comparison } from '../harness.js';
import { makeCompetitorArm } from './compactors.js';

/**
 * RTK (rust-token-killer) — the predecessor that produces terse summaries of
 * CLI/shell output. Modelled here as a non-query-aware extractive compactor:
 * it drops connective prose and progress chatter but keeps every structured
 * line, so it retains facts yet still surfaces some irrelevant structured rows.
 */
export const rtkComparison: Comparison = {
  competitor: 'rtk',
  label: 'RTK (rust-token-killer)',
  benchmark: 'tool-output',
  description: 'Shell/CLI output summarizer. UTK matches its fact retention while cutting far more visible tokens by keeping raw recoverable off-context.',
  competitorArm: makeCompetitorArm({ keepThreshold: 0.10 }),
  middleware: [
    (config) => ({ ...config, skills: [...config.skills, 'rtk-shell-summary'] })
  ]
};

export default rtkComparison;
