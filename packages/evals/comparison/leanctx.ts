import { addSkill, type Competitor } from './compactors.js';

/**
 * LeanCTX — a Copilot context-runtime that keeps query-relevant content and sheds
 * the rest before it reaches the window. Modelled as a query-aware extractive
 * compactor tuned to keep relevant prose alongside structured lines. It compacts
 * in place, so it still spends the surviving tokens where UTK spends only a handle.
 */
export const leanctx: Competitor = {
  name: 'leanctx',
  label: 'LeanCTX (context runtime)',
  description: 'Query-aware Copilot context runtime. UTK keeps the same facts recoverable at a fraction of the visible tokens by moving the payload off-context.',
  keepThreshold: 0.14,
  queryAware: true,
  middleware: [addSkill('leanctx-context-runtime')]
};

export default leanctx;
