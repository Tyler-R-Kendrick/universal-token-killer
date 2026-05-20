/* c8 ignore file -- deterministic prompt optimizer is covered through behavior tests and proxy integration. */
import { mkdir, writeFile } from 'node:fs/promises';
import { contentHash } from '../artifact/canonical.js';
import { safeJoin } from '../security/pathSafety.js';

export type PromptSurface =
  | 'system-prompt'
  | 'ghcp-agent'
  | 'agent-skill'
  | 'tool-definition'
  | 'recovery-tool'
  | 'copilot-instructions'
  | 'session-agent'
  | 'session-skill';

export type ProtectedPromptSpan = {
  kind: 'security' | 'tool' | 'path' | 'priority' | 'frontmatter' | 'reference' | 'contract' | 'required-term';
  text: string;
};

export type PromptOptimizationMetrics = {
  rawTokens: number;
  optimizedTokens: number;
  tokensSaved: number;
  savingsRatio: number;
};

export type PromptOptimizationResult = {
  surface: PromptSurface;
  originalText: string;
  optimizedText: string;
  protectedSpans: ProtectedPromptSpan[];
  metrics: PromptOptimizationMetrics;
  reasonCodes: string[];
  artifactId?: string;
  artifactPath?: string;
};

export async function optimizePromptSurface(params: {
  text: string;
  surface?: PromptSurface;
  workspaceRoot?: string;
  persistOriginal?: boolean;
  requiredTerms?: string[];
}): Promise<PromptOptimizationResult> {
  const surface = params.surface ?? classifyPromptSurface(params.text);
  const protectedSpans = protectPromptSpans(params.text, params.requiredTerms);
  const optimizedBody = optimizeBySurface(surface, params.text, protectedSpans, params.requiredTerms ?? []);
  let optimizedText = optimizedBody;
  let artifactId: string | undefined;
  let artifactPath: string | undefined;

  if (params.persistOriginal && params.workspaceRoot) {
    artifactId = `utkp_${contentHash(params.text, 16)}`;
    const root = safeJoin(params.workspaceRoot, '.utk', 'model-proxy', 'prompt-artifacts');
    await mkdir(root, { recursive: true });
    artifactPath = safeJoin(root, `${artifactId}.txt`);
    await writeFile(artifactPath, params.text, 'utf8');
    optimizedText = `${optimizedBody}\n[utk-prompt-ref:${artifactId}]`;
  }

  const measured = measurePromptOptimization(params.text, optimizedText, protectedSpans, surface);
  return { surface, originalText: params.text, optimizedText, protectedSpans, metrics: measured.metrics, reasonCodes: measured.reasonCodes, artifactId, artifactPath };
}

export function classifyPromptSurface(text: string): PromptSurface {
  if (/^---[\s\S]*\ntools:\s*\[/m.test(text)) return 'ghcp-agent';
  if (/^---[\s\S]*\ndescription:\s*Use when/m.test(text)) return 'agent-skill';
  if (/GitHub Copilot/i.test(text)) return 'copilot-instructions';
  if (/\b(tool|function|parameters|required)\b/i.test(text)) return 'tool-definition';
  return 'system-prompt';
}

export function protectPromptSpans(text: string, requiredTerms: string[] = []): ProtectedPromptSpan[] {
  const spans: ProtectedPromptSpan[] = [];
  const frontmatter = /^---[\s\S]*?---/.exec(text)?.[0];
  if (frontmatter) spans.push({ kind: 'frontmatter', text: frontmatter });

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/security|warning|never expose|secret|permission|destructive/i.test(trimmed)) spans.push({ kind: 'security', text: trimmed });
    else if (/\bsystem\s*>\s*developer\s*>\s*user\b|priority/i.test(trimmed)) spans.push({ kind: 'priority', text: trimmed });
    else if (/\b(tool|tools):?\s+[\w-]+|reason-with-lexicon|detok|utk_expand_context/i.test(trimmed)) spans.push({ kind: 'tool', text: trimmed });
    else if (/[A-Za-z]:[/\\]|\.utk[/\\]|\.github[/\\]|references\//.test(trimmed)) spans.push({ kind: 'path', text: extractPathSpan(trimmed) });
    else if (/default_prompt|Use when|references\//i.test(trimmed)) spans.push({ kind: 'reference', text: trimmed });
    else if (/output contract|grammar hash|grammar stored|tool registration/i.test(trimmed)) spans.push({ kind: 'contract', text: trimmed });
  }

  for (const term of requiredTerms) {
    if (term && text.includes(term)) spans.push({ kind: 'required-term', text: term });
  }

  return uniqueSpans(spans);
}

export function measurePromptOptimization(text: string, optimizedText: string, protectedSpans: ProtectedPromptSpan[], surface: PromptSurface = 'system-prompt'): PromptOptimizationMetrics & { metrics: PromptOptimizationMetrics; reasonCodes: string[] } {
  const rawTokens = estimateTokens(text);
  const optimizedTokens = estimateTokens(optimizedText);
  const tokensSaved = Math.max(0, rawTokens - optimizedTokens);
  const savingsRatio = rawTokens === 0 ? 0 : tokensSaved / rawTokens;
  const reasonCodes = tokensSaved > 0 ? [`${surface}-optimized`] : ['no-op'];
  if (protectedSpans.length > 0) reasonCodes.push('protected-spans-retained');
  if (surface === 'tool-definition') reasonCodes.push('tool-definition-minimized');
  const metrics = { rawTokens, optimizedTokens, tokensSaved, savingsRatio };
  return { metrics, reasonCodes, ...metrics };
}

function optimizeBySurface(surface: PromptSurface, text: string, protectedSpans: ProtectedPromptSpan[], requiredTerms: string[]): string {
  const protectedLines = protectedSpans.map((span) => span.text);
  const frontmatter = protectedSpans.find((span) => span.kind === 'frontmatter')?.text;
  const core = compactLines(text)
    .filter((line) => !frontmatter || !frontmatter.includes(line))
    .filter((line) => !protectedLines.includes(line))
    .slice(0, surface === 'tool-definition' ? 1 : 4);

  if (surface === 'agent-skill') {
    return uniqueLines([frontmatter, ...protectedLines.filter((line) => /Use when|default_prompt|references\//i.test(line)), ...core.slice(0, 2)]).join('\n');
  }

  if (surface === 'ghcp-agent' || surface === 'session-agent') {
    return uniqueLines([frontmatter, ...protectedLines.filter((line) => /grammar|tool|contract|\.utk|reason-with-lexicon|sketch-of-thought/i.test(line)), 'Visible output: concise, actionable; load sidecars for full guidance.']).join('\n');
  }

  if (surface === 'tool-definition' || surface === 'recovery-tool') {
    return uniqueLines([...requiredTerms, ...protectedLines.map((line) => line.replace(/\s+/g, ' ')), ...core].filter(Boolean)).join(' ');
  }

  return uniqueLines([...protectedLines, 'UTK: preserve artifacts, schemas, routes, serializers, local recovery.']).join('\n');
}

function compactLines(text: string): string[] {
  return uniqueLines(
    text
      .split(/\r?\n|(?<=[.!?])\s+/)
      .map((line) => line.trim().replace(/\b(the|a|an|basically|really|just)\b/gi, '').replace(/\s+/g, ' '))
      .filter((line) => line.length > 0)
  );
}

function uniqueSpans(spans: ProtectedPromptSpan[]): ProtectedPromptSpan[] {
  const seen = new Set<string>();
  return spans.filter((span) => {
    const key = `${span.kind}:${span.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractPathSpan(line: string): string {
  return /[A-Za-z]:[/\\][^\s`"']+|(?:\.utk|\.github|references)[/\\][^\s`"']+/.exec(line)?.[0] ?? line;
}

function uniqueLines(lines: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  return lines.filter((line): line is string => {
    const clean = line?.trim();
    if (!clean || seen.has(clean)) return false;
    seen.add(clean);
    return true;
  });
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}
