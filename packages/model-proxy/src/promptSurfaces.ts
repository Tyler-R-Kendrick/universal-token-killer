import { optimizePromptSurface, type PromptOptimizationResult, type PromptSurface } from '@utk/core';
import { isObject, type JsonObject } from './openai.js';

export type PromptSurfaceOptimization = {
  before: number;
  after: number;
  artifacts: Array<{ id: string; path: string; surface: string }>;
};

export async function optimizeChatPromptMessages(messages: JsonObject[], workspaceRoot: string): Promise<PromptSurfaceOptimization> {
  let before = 0;
  let after = 0;
  const artifacts: PromptSurfaceOptimization['artifacts'] = [];
  for (const message of messages) {
    if (!isSystemLikeRole(message.role) || typeof message.content !== 'string') continue;
    const surface = 'system-prompt';
    const optimized = await optimizePrompt({ workspaceRoot, surface, text: message.content, persistOriginal: true });
    message.content = optimized.optimizedText;
    before += optimized.metrics.rawTokens;
    after += optimized.metrics.optimizedTokens;
    if (optimized.artifactId && optimized.artifactPath) artifacts.push({ id: optimized.artifactId, path: optimized.artifactPath, surface });
  }
  return { before, after, artifacts };
}

export async function optimizeResponsesPromptSurfaces(request: JsonObject, workspaceRoot: string): Promise<PromptSurfaceOptimization> {
  let before = 0;
  let after = 0;
  const artifacts: PromptSurfaceOptimization['artifacts'] = [];
  if (typeof request.instructions === 'string') {
    const optimized = await optimizePrompt({ workspaceRoot, surface: 'system-prompt', text: request.instructions, persistOriginal: true });
    request.instructions = optimized.optimizedText;
    before += optimized.metrics.rawTokens;
    after += optimized.metrics.optimizedTokens;
    if (optimized.artifactId && optimized.artifactPath) artifacts.push({ id: optimized.artifactId, path: optimized.artifactPath, surface: 'system-prompt' });
  }

  const items = Array.isArray(request.input) ? request.input : [];
  for (const item of items) {
    if (!isObject(item) || !isSystemLikeRole(item.role) || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (!isObject(part) || typeof part.text !== 'string') continue;
      const optimized = await optimizePrompt({ workspaceRoot, surface: 'system-prompt', text: part.text, persistOriginal: true });
      part.text = optimized.optimizedText;
      before += optimized.metrics.rawTokens;
      after += optimized.metrics.optimizedTokens;
      if (optimized.artifactId && optimized.artifactPath) artifacts.push({ id: optimized.artifactId, path: optimized.artifactPath, surface: 'system-prompt' });
    }
  }
  return { before, after, artifacts };
}

async function optimizePrompt(params: { workspaceRoot: string; surface: PromptSurface; text: string; persistOriginal: boolean }): Promise<PromptOptimizationResult> {
  return optimizePromptSurface(params);
}

function isSystemLikeRole(role: unknown): boolean {
  return role === 'system' || role === 'developer';
}
