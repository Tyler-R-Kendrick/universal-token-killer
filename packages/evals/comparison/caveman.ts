import { addSkill, type Competitor } from './compactors.js';

/**
 * Caveman — a terse output-style skill that strips prose to a "caveman" register.
 * Modelled as an aggressive extractive compactor, so it wins a large share of the
 * visible-token savings among competitors but still ships its (lossy) compaction
 * inside the chat context rather than off to a recoverable artifact the way UTK does.
 */
export const caveman: Competitor = {
  name: 'caveman',
  label: 'Caveman (terse register)',
  description: 'Aggressive terse rewriter. UTK keeps the same facts recoverable while spending a fraction of the visible tokens.',
  keepThreshold: 0.18,
  middleware: [addSkill('caveman-terse')]
};

export default caveman;
