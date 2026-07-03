import type { Comparison } from '../harness.js';
import { makeCompetitorArm } from './compactors.js';

/**
 * Compresr — a query-aware compression SDK. Modelled as a query-aware extractive
 * compactor: it uses the prompt to keep relevant lines (including relevant prose)
 * and drops the rest more aggressively, so it tends to shed noise better than the
 * unaware summarizers — but it still emits the surviving text into the context
 * window, where UTK emits only a recoverable handle.
 */
export const compresrComparison: Comparison = {
  competitor: 'compresr',
  label: 'Compresr (query-aware)',
  benchmark: 'tool-output',
  description: 'Query-aware compressor. UTK reaches deeper token cuts at equal fact retention by never placing the payload in context.',
  competitorArm: makeCompetitorArm({ keepThreshold: 0.16, queryAware: true }),
  middleware: [
    (config) => ({ ...config, skills: [...config.skills, 'compresr-query-aware'] })
  ]
};

export default compresrComparison;
