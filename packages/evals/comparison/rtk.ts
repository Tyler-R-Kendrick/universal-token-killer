import { addSkill, type Competitor } from './compactors.js';

/**
 * RTK (rust-token-killer) — the predecessor that produces terse summaries of
 * CLI/shell output. Modelled as a non-query-aware extractive compactor: it drops
 * connective prose and progress chatter but keeps every structured line, so it
 * retains facts yet still surfaces some irrelevant structured rows.
 */
export const rtk: Competitor = {
  name: 'rtk',
  label: 'RTK (rust-token-killer)',
  description: 'Shell/CLI output summarizer. UTK matches its fact retention while cutting far more visible tokens by keeping raw recoverable off-context.',
  keepThreshold: 0.1,
  middleware: [addSkill('rtk-shell-summary')]
};

export default rtk;
