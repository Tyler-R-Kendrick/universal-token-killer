import type { UtkConfig } from '@utk/config';
import {
  cachedToolEmbeddings,
  cosineSimilarity,
  resolveLocalToolEmbeddingProvider,
  type LocalToolEmbeddingProvider,
  type LocalToolEmbeddingProviderAdapterEntry
} from './toolEmbedding.js';
import type { ToolCandidate } from './toolMatchingCandidates.js';
import type { CandidateScore } from './toolMatchingScoreTypes.js';
import { inferCommandTail, uniqueWinner } from './toolMatchingSelection.js';

export async function selectEmbeddingCandidate(
  workspaceRoot: string,
  request: string,
  candidates: ToolCandidate[],
  config: UtkConfig,
  providerOverride?: LocalToolEmbeddingProvider,
  providersOverride?: LocalToolEmbeddingProvider[],
  providerAdapters?: readonly LocalToolEmbeddingProviderAdapterEntry[]
): Promise<CandidateScore | undefined> {
  try {
    const provider = await resolveLocalToolEmbeddingProvider(config.tool_matching, providerOverride, providersOverride, providerAdapters);
    if (!provider) return undefined;
    const candidateEmbeddings = await cachedToolEmbeddings(
      workspaceRoot,
      provider,
      candidates.map((candidate) => ({ name: candidate.name, text: candidate.embeddingText })),
      config.tool_matching.embedding_cache
    );
    const [requestEmbedding] = await provider.embed([request]);
    if (!requestEmbedding) return undefined;
    const scores = candidates.map((candidate) => ({
      candidate,
      score: cosineSimilarity(requestEmbedding, candidateEmbeddings.get(candidate.name) ?? []),
      reason: 'embedding' as const,
      tail: inferCommandTail(request, candidate)
    }));
    return uniqueWinner(scores, config.tool_matching.embedding_similarity_threshold, config.tool_matching.winner_gap);
  } catch {
    return undefined;
  }
}
