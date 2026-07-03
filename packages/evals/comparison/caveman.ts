import type { Comparison } from '../harness.js';
import { makeCompetitorArm } from './compactors.js';

/**
 * Caveman — a terse output-style skill that strips prose to a "caveman" register.
 * Modelled as an aggressive extractive compactor that also collapses whitespace,
 * so it wins the most visible-token savings among competitors but still ships its
 * (lossy) compaction inside the chat context rather than off to a recoverable
 * artifact the way UTK does.
 */
export const cavemanComparison: Comparison = {
  competitor: 'caveman',
  label: 'Caveman (terse register)',
  benchmark: 'tool-output',
  description: 'Aggressive terse rewriter. UTK keeps the same facts recoverable while spending a fraction of the visible tokens.',
  competitorArm: makeCompetitorArm({ keepThreshold: 0.18 }),
  middleware: [
    (config) => ({ ...config, skills: [...config.skills, 'caveman-terse'] })
  ]
};

export default cavemanComparison;
