import { routeContentForProxy } from './contentRouter.js';
import { estimateTokens } from './openai.js';
import { type ContextArtifact, persistCompactContextArtifact, persistContextArtifact } from './recovery.js';

export type CompactedToolText = {
  text: string;
  artifact: ContextArtifact;
  routeReason: string;
};

export async function compactToolText(workspaceRoot: string, content: string, query: string): Promise<CompactedToolText> {
  const routed = routeContentForProxy(content, query);
  const artifact = await persistContextArtifact({
    workspaceRoot,
    content,
    kind: routed.kind,
    rawTokens: routed.rawTokens,
    compactTokens: routed.compactTokens
  });
  const text = [
    `[utk-ref:${artifact.id}] ${routed.routeReason}; raw omitted; call utk_expand_context with id to recover full payload.`,
    routed.compactText
  ].join('\n');
  const compactArtifact = await persistCompactContextArtifact(workspaceRoot, artifact, text);
  return { text, artifact: { ...compactArtifact, compactTokens: estimateTokens(text) }, routeReason: routed.routeReason };
}
