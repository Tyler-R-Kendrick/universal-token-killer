import { rtk } from './rtk.js';
import { leanctx } from './leanctx.js';
import { compresr } from './compresr.js';
import { caveman } from './caveman.js';
import { ponytail } from './ponytail.js';
import type { Competitor } from './compactors.js';

export { makeCompetitorArm, addSkill, infoScore, type Competitor, type CompetitorConfig } from './compactors.js';
export { rtk } from './rtk.js';
export { leanctx } from './leanctx.js';
export { compresr } from './compresr.js';
export { caveman } from './caveman.js';
export { ponytail } from './ponytail.js';

/** Every registered competitor, in leaderboard order (least → most aggressive). */
export const COMPETITORS: Competitor[] = [rtk, leanctx, compresr, caveman, ponytail];

export function getCompetitor(name: string): Competitor | undefined {
  return COMPETITORS.find((competitor) => competitor.name === name);
}
