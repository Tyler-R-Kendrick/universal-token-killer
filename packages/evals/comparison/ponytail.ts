import { addSkill, type Competitor } from './compactors.js';

/**
 * Ponytail — a "write less" / minimum-viable-emission technique. Modelled as the
 * most aggressive extractive compactor: it keeps only the highest-signal lines, so
 * it reaches the fewest visible tokens of any competitor but has the least margin
 * before it starts dropping a required fact. Even at its most aggressive it still
 * emits the survivors into context, where UTK emits only a recoverable handle.
 */
export const ponytail: Competitor = {
  name: 'ponytail',
  label: 'Ponytail (minimum emission)',
  description: 'Aggressive minimum-emission compactor. UTK reaches deeper cuts at guaranteed fact retention by never emitting the payload into context.',
  keepThreshold: 0.24,
  middleware: [addSkill('ponytail-min-emission')]
};

export default ponytail;
