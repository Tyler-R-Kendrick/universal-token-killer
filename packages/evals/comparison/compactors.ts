import type { BenchmarkCase } from '../data.js';
import type { ArmTechnique, Middleware, SessionConfig } from '../harness.js';
import type { ArmOutput } from '../graders/shared.js';

/**
 * A competitor technique, benchmark-agnostic: the same config runs across every
 * benchmark. Providers differ only in aggressiveness ({@link CompetitorConfig})
 * and the session skill they tag; the compaction algorithm is shared.
 */
export type Competitor = {
  /** Competitor slug (e.g. "rtk"). */
  name: string;
  /** Human-readable label used on the leaderboard. */
  label: string;
  description: string;
  /** Primary operating point: the keep-threshold shown on the leaderboard + Pareto chart. */
  keepThreshold: number;
  /** Also retain lines sharing a salient keyword with the prompt (query-aware compression). */
  queryAware?: boolean;
  /** Session hooks (tools/skills/model) applied to this competitor's arm. */
  middleware?: Middleware[];
};

/** Middleware that tags an arm's session with a provider skill (records how the arm was configured). */
export function addSkill(skill: string): Middleware {
  return (config: SessionConfig): SessionConfig => ({ ...config, skills: [...config.skills, skill] });
}

/**
 * Config knobs shared by every competitor arm. Providers differ only in these
 * values — the compaction algorithm (extractive line selection) is identical,
 * which is what lets the harness run "the same benchmark data through the same
 * harness with slight variations in configuration per provider".
 */
export type CompetitorConfig = {
  /** Keep lines whose structural-information score is at least this (0..1). Higher = more aggressive drop. */
  keepThreshold: number;
  /** Also retain lines that share a salient keyword with the prompt (query-aware compression). */
  queryAware?: boolean;
};

const STOP_WORDS = new Set([
  'summarize', 'without', 'while', 'preserving', 'retaining', 'output', 'compress',
  'their', 'about', 'which', 'these', 'those', 'there', 'where', 'when', 'what', 'give',
  'find', 'return', 'report', 'flag', 'note', 'list', 'explain', 'threw'
]);

// Pure chatter a competent summarizer drops outright.
const NOISE = /^\(use |downloading|extracting|^note: |refreshing state|warming up|new major version|^npm notice|^npm warn deprecated|no changes added to commit/i;
// Fact-bearing status/error signal that must survive compaction.
const SALIENT = /error|exception|fail|warn|denied|conflict|unhealthy|crash|panic|fatal|timeout|refused|missing|rotate|secret|leak|\bplan\b|created|destroyed|modified|untracked|deprecated|listening/i;

/** Build a competitor arm technique from a provider config. */
export function makeCompetitorArm(config: CompetitorConfig): ArmTechnique {
  return (testCase: BenchmarkCase): ArmOutput => {
    const keywords = config.queryAware ? promptKeywords(testCase.prompt) : [];
    const kept = testCase.rawOutput.split('\n').filter((line) => keepLine(line, config, keywords));
    const text = kept.join('\n');
    return { visibleText: text, recoverableText: text };
  };
}

function keepLine(line: string, config: CompetitorConfig, keywords: string[]): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0) return false;
  if (config.queryAware && matchesKeyword(trimmed, keywords)) return true;
  if (NOISE.test(trimmed)) return false;
  if (infoScore(trimmed) >= config.keepThreshold) return true;
  if (SALIENT.test(trimmed)) return true;
  if (/[A-Z]{3,}/.test(trimmed)) return true; // ALLCAPS tokens: ERESOLVE, OPEN, WARN
  if (/[/\\][\w.-]+\.[A-Za-z0-9]+/.test(trimmed)) return true; // path with a file extension
  return false;
}

/**
 * Density of "structural" characters (digits, punctuation, path separators,
 * bracket/quote symbols, uppercase runs) over line length. Structured output —
 * paths, errors, tables, JSON — scores high; connective prose scores near zero.
 */
export function infoScore(line: string): number {
  const trimmed = line.trim();
  if (trimmed.length === 0) return 0;
  const structural = (trimmed.match(/[0-9/\\.:=@#|_%{}\[\]"'()-]/g) ?? []).length;
  const upperRuns = (trimmed.match(/[A-Z]{2,}/g) ?? []).length;
  return (structural + upperRuns * 2) / trimmed.length;
}

function promptKeywords(prompt: string): string[] {
  return (prompt.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []).filter((word) => !STOP_WORDS.has(word));
}

function matchesKeyword(line: string, keywords: string[]): boolean {
  const lower = line.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
}
