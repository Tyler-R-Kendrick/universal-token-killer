import type { Comparison } from '../harness.js';
import { rtkComparison } from './rtk.js';
import { cavemanComparison } from './caveman.js';
import { compresrComparison } from './compresr.js';

export { makeCompetitorArm, infoScore, type CompetitorConfig } from './compactors.js';
export { rtkComparison } from './rtk.js';
export { cavemanComparison } from './caveman.js';
export { compresrComparison } from './compresr.js';

/** Every registered competitor comparison, in report order. */
export const COMPARISONS: Comparison[] = [rtkComparison, compresrComparison, cavemanComparison];

export function getComparison(competitor: string): Comparison | undefined {
  return COMPARISONS.find((comparison) => comparison.competitor === competitor);
}
