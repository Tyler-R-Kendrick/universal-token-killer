import { loadUtkConfig, type UtkConfig } from '@utk/config';
import type { LocalToolEmbeddingProvider, LocalToolEmbeddingProviderAdapterEntry } from './toolEmbedding.js';
import { buildToolArgs } from './toolArgumentExtraction.js';
import { buildToolCandidates, findSlashCandidate, type ToolCandidate } from './toolMatchingCandidates.js';
import {
  isAmbiguousSearchRequest,
  levelAllows,
  selectEmbeddingCandidate,
  selectExactCandidate,
  selectLexicalCandidate,
  selectRegexCandidate,
  type CandidateScore,
  type MatchReason
} from './toolMatchingScoring.js';

export type ToolInvocationMatchRequest = {
  workspaceRoot: string;
  request: string;
  tools?: unknown;
  config?: UtkConfig;
  embeddingProvider?: LocalToolEmbeddingProvider;
  embeddingProviders?: LocalToolEmbeddingProvider[];
  embeddingProviderAdapters?: readonly LocalToolEmbeddingProviderAdapterEntry[];
};

export type ToolInvocationMatch =
  | {
      kind: 'match';
      toolName: string;
      tool: Record<string, unknown>;
      args: Record<string, unknown>;
      confidence: number;
      reason: MatchReason;
      metricReason: string;
    }
  | {
      kind: 'clarify';
      toolName: string;
      missingRequired: string[];
      message: string;
      reason: 'missing-required-args';
      metricReason: 'tool-bypass-missing-args';
    }
  | {
      kind: 'miss';
      reason: 'disabled' | 'no-tools' | 'no-match' | 'ambiguous' | 'denied-tool' | 'protected-tool' | 'negated' | 'explanatory';
      metricReason: string;
      candidates?: Array<{ toolName: string; score: number; reason: string }>;
    };

export async function matchToolInvocation(input: ToolInvocationMatchRequest): Promise<ToolInvocationMatch> {
  const config = input.config ?? await loadUtkConfig(input.workspaceRoot);
  if (!config.tool_matching.enabled) return { kind: 'miss', reason: 'disabled', metricReason: 'tool-bypass-disabled' };
  const request = input.request.trim();
  const candidates = buildToolCandidates(input.tools, config);
  if (candidates.length === 0) return { kind: 'miss', reason: 'no-tools', metricReason: 'tool-bypass-no-tools' };

  const slash = parseSlashCommand(request);
  if (slash) {
    const candidate = findSlashCandidate(candidates, slash.command);
    if (!candidate) return { kind: 'miss', reason: 'no-match', metricReason: 'tool-bypass-no-match' };
    return finalizeCandidate(candidate, slash.tail, request, 'slash-command', 1, config, {});
  }

  if (isNegatedRequest(request)) return { kind: 'miss', reason: 'negated', metricReason: 'tool-bypass-negated' };
  if (isExplanatoryRequest(request)) return { kind: 'miss', reason: 'explanatory', metricReason: 'tool-bypass-explanatory' };

  if (levelAllows(config.tool_matching.level, 'lexical-similarity') && config.tool_matching.prefer_local_embeddings) {
    const embedding = await selectEmbeddingCandidate(input.workspaceRoot, request, candidates, config, input.embeddingProvider, input.embeddingProviders, input.embeddingProviderAdapters);
    if (embedding) return finalizeCandidateScore(embedding, request, config);
  }

  if (levelAllows(config.tool_matching.level, 'exact-lexical-match')) {
    const exact = selectExactCandidate(request, candidates, config);
    if (exact) return finalizeCandidateScore(exact, request, config);
  }

  if (isAmbiguousSearchRequest(request, candidates)) {
    return {
      kind: 'miss',
      reason: 'ambiguous',
      metricReason: 'tool-bypass-ambiguous',
      candidates: candidates.filter((candidate) => candidate.searchLike).map((candidate) => ({ toolName: candidate.name, score: 0.8, reason: 'search-like' }))
    };
  }

  if (levelAllows(config.tool_matching.level, 'regex-patterns')) {
    const regex = selectRegexCandidate(request, candidates, config);
    if (regex) return finalizeCandidateScore(regex, request, config);
  }

  if (levelAllows(config.tool_matching.level, 'lexical-similarity')) {
    const lexical = selectLexicalCandidate(request, candidates, config);
    if (lexical) return finalizeCandidateScore(lexical, request, config);
  }

  return { kind: 'miss', reason: 'no-match', metricReason: 'tool-bypass-no-match' };
}

function finalizeCandidate(
  candidate: ToolCandidate,
  tail: string | undefined,
  request: string,
  reason: MatchReason,
  confidence: number,
  config: UtkConfig,
  captures: Record<string, string>,
  configuredRegex = false
): ToolInvocationMatch {
  if (candidate.denied) return { kind: 'miss', reason: 'denied-tool', metricReason: 'tool-bypass-denied' };
  if (candidate.protected && reason !== 'slash-command' && !(reason === 'regex-pattern' && configuredRegex && candidate.bypassOnMatch)) {
    return { kind: 'miss', reason: 'protected-tool', metricReason: 'tool-bypass-protected' };
  }
  const args = buildToolArgs(candidate, request, tail ?? '', captures);
  const missing = candidate.required.filter((name) => args[name] === undefined);
  if (missing.length > 0) {
    return {
      kind: 'clarify',
      toolName: candidate.name,
      missingRequired: missing,
      message: `Missing required arguments for ${candidate.name}: ${missing.join(', ')}`,
      reason: 'missing-required-args',
      metricReason: 'tool-bypass-missing-args'
    };
  }
  return {
    kind: 'match',
    toolName: candidate.name,
    tool: candidate.tool,
    args,
    confidence,
    reason,
    metricReason: `tool-bypass-${reason}`
  };
}

function finalizeCandidateScore(score: CandidateScore, request: string, config: UtkConfig): ToolInvocationMatch {
  return finalizeCandidate(score.candidate, score.tail, request, score.reason, score.score, config, score.captures ?? {}, score.configuredRegex);
}

function parseSlashCommand(request: string): { command: string; tail: string } | undefined {
  const match = /^\s*\/([A-Za-z0-9_.-]+)(?:\s+([\s\S]*))?\s*$/.exec(request);
  if (!match?.[1]) return undefined;
  return { command: match[1], tail: match[2] ?? '' };
}

function isNegatedRequest(request: string): boolean {
  return /\b(do\s+not|don't|dont|never|avoid|without\s+calling\s+tools?)\b/i.test(request);
}

function isExplanatoryRequest(request: string): boolean {
  return /\b(how\s+to|explain|what\s+is|what\s+does|why\s+did|tell\s+me\s+what|read\s+my\s+mind|discussion\s+about|sounds\s+like|not\s+a\s+file|hard\s+to\s+configure)\b/i.test(request);
}
