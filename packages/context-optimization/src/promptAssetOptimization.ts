import { mkdir, writeFile } from 'node:fs/promises';
import { contentHash } from '@utk/foundation';
import { safeJoin } from '@utk/foundation';
import { estimateTokens } from '@utk/foundation';
import type { PromptSurface } from '@utk/prompt-optimization';

export async function optimizePromptAsset(params: {
  text: string;
  surface?: PromptSurface;
  workspaceRoot?: string;
  persistOriginal?: boolean;
}) {
  let optimizedText = toPipeIndex(params.text);
  let artifactId: string | undefined;
  let artifactPath: string | undefined;
  if (params.persistOriginal && params.workspaceRoot) {
    artifactId = `utkp_${contentHash(params.text, 16)}`;
    const root = safeJoin(params.workspaceRoot, '.utk', 'model-proxy', 'prompt-artifacts');
    await mkdir(root, { recursive: true });
    artifactPath = safeJoin(root, `${artifactId}.txt`);
    await writeFile(artifactPath, params.text, 'utf8');
    optimizedText = `${optimizedText}\n[utk-prompt-ref:${artifactId}]`;
  }
  const rawTokens = estimateTokens(params.text);
  const optimizedTokens = estimateTokens(optimizedText);
  return {
    surface: params.surface ?? 'system-prompt',
    originalText: params.text,
    optimizedText,
    protectedSpans: [],
    reasonCodes: ['prompt-asset-optimized', 'pipe-index'],
    artifactId,
    artifactPath,
    metrics: {
      rawTokens,
      optimizedTokens,
      tokensSaved: Math.max(0, rawTokens - optimizedTokens),
      savingsRatio: rawTokens === 0 ? 0 : Math.max(0, rawTokens - optimizedTokens) / rawTokens
    }
  };
}

function toPipeIndex(text: string): string {
  const frontmatter = /^---[\s\S]*?---/.exec(text)?.[0];
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const protectedLines = lines.filter((line) =>
    /^---$/.test(line) ||
    /^(name|description|tools):/.test(line) ||
    /Security warning|Priority:|system > developer > user|Use when|default_prompt|Grammar hash|grammar stored|Output contract|\.utk|references\//i.test(line)
  );
  const body = unique([
    frontmatter,
    '|IMPORTANT: retrieval-led; read refs before relying on stale memory',
    ...protectedLines.filter((line) => !frontmatter?.includes(line)).map(compactPromptAssetLine)
  ]);
  return body.join('\n');
}

function compactPromptAssetLine(line: string): string {
  const grammarHash = /Grammar hash `?([A-Za-z0-9_-]+)`?/i.exec(line)?.[1];
  if (grammarHash) return `Grammar hash ${grammarHash}.`;
  return line.replace(/\s+/g, ' ');
}


function unique(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  return values.filter((value): value is string => {
    const clean = value?.trim();
    if (!clean || seen.has(clean)) return false;
    seen.add(clean);
    return true;
  });
}
