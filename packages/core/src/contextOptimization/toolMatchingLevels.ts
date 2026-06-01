import type { ToolMatchingLevel } from '../config/config.js';

const LEVEL_RANK: Record<ToolMatchingLevel, number> = {
  'slash-commands': 0,
  'exact-lexical-match': 1,
  'regex-patterns': 2,
  'lexical-similarity': 3
};

export function levelAllows(level: ToolMatchingLevel, required: ToolMatchingLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[required];
}
