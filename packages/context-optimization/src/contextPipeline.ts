import { ContextBudgetManager } from './contextBudget.js';
import { detectCacheVolatility } from './cacheVolatility.js';
import { optimizePromptAsset } from './promptAssetOptimization.js';
import {
  filterToolDefinitionsForIntent,
  type ToolDiscoveryMode
} from './toolDiscovery.js';

export function createContextOptimizationPipeline(options: {
  workspaceRoot: string;
  maxContextTokens: number;
  reserveOutputTokens: number;
  historyCompactionThreshold: number;
  toolDiscoveryMode?: ToolDiscoveryMode;
}) {
  const budgetManager = new ContextBudgetManager({
    maxContextTokens: options.maxContextTokens,
    reserveOutputTokens: options.reserveOutputTokens,
    historyCompactionThreshold: options.historyCompactionThreshold
  });
  return {
    async optimize(params: {
      model: string;
      inputTokens: number;
      intent: string;
      promptAssets?: string[];
      tools?: unknown;
    }) {
      const promptAssets = await Promise.all((params.promptAssets ?? []).map((text) => optimizePromptAsset({ text, workspaceRoot: options.workspaceRoot, persistOriginal: true })));
      return {
        budget: budgetManager.evaluate({ inputTokens: params.inputTokens, model: params.model }),
        toolDiscovery: filterToolDefinitionsForIntent(params.tools ?? [], { intent: params.intent, mode: options.toolDiscoveryMode ?? 'static-filter' }),
        promptAssets,
        cacheVolatility: detectCacheVolatility((params.promptAssets ?? []).join('\n'))
      };
    }
  };
}
