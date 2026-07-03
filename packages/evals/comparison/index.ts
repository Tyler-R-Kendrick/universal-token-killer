import type { Comparison } from '../harness.js';
import { rtkComparison } from './rtk.js';
import { leanctxComparison } from './leanctx.js';
import { compresrComparison } from './compresr.js';
import { cavemanComparison } from './caveman.js';
import { ponytailComparison } from './ponytail.js';

export { makeCompetitorArm, addSkill, infoScore, type CompetitorConfig } from './compactors.js';
export { rtkComparison } from './rtk.js';
export { leanctxComparison } from './leanctx.js';
export { compresrComparison } from './compresr.js';
export { cavemanComparison } from './caveman.js';
export { ponytailComparison } from './ponytail.js';

/** Every registered competitor comparison, in leaderboard order. */
export const COMPARISONS: Comparison[] = [
  rtkComparison,
  leanctxComparison,
  compresrComparison,
  cavemanComparison,
  ponytailComparison
];

export function getComparison(competitor: string): Comparison | undefined {
  return COMPARISONS.find((comparison) => comparison.competitor === competitor);
}
