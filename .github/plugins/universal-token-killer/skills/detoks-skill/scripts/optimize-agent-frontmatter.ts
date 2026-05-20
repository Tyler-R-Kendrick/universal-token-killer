import { createHash } from 'node:crypto';
import { estimateTokens } from './analyze-skill';

export interface AgentFrontmatterOptimizationResult {
  originalFrontmatter: string;
  optimizedContext: string;
  declarations: Record<string, string>;
  declarationsUnchanged: boolean;
  originalTokens: number;
  optimizedTokens: number;
  tokensSaved: number;
  reasonCodes: string[];
}

export function optimizeAgentSkillFrontmatterForContext(skillText: string): AgentFrontmatterOptimizationResult {
  const match = /^(---\r?\n([\s\S]*?)\r?\n---)/u.exec(skillText);
  if (!match) throw new Error('Agent Skill must start with YAML frontmatter');
  const originalFrontmatter = match[1]!;
  const declarations = parseDeclarations(match[2]!);
  const hash = createHash('sha256').update(originalFrontmatter).digest('hex').slice(0, 16);
  const optimizedContext = [
    `frontmatter-ref:${hash}`,
    declarations.name ? `name:${declarations.name}` : undefined,
    declarations.description ? `description:${compactDescription(declarations.description)}` : undefined,
    'declarations:preserved-exactly-in-SKILL.md'
  ].filter(Boolean).join('\n');
  const originalTokens = estimateTokens(originalFrontmatter);
  const optimizedTokens = estimateTokens(optimizedContext);

  return {
    originalFrontmatter,
    optimizedContext,
    declarations,
    declarationsUnchanged: true,
    originalTokens,
    optimizedTokens,
    tokensSaved: Math.max(0, originalTokens - optimizedTokens),
    reasonCodes: ['frontmatter-context-optimized', 'declarations-preserved']
  };
}

function parseDeclarations(frontmatterBody: string): Record<string, string> {
  return Object.fromEntries(
    frontmatterBody
      .split(/\r?\n/u)
      .map((line) => /^([a-z-]+):\s*(.+)$/u.exec(line))
      .filter((entry): entry is RegExpExecArray => entry !== null)
      .map((entry) => [entry[1]!, entry[2]!.replace(/^"(.*)"$/u, '$1')])
  );
}

function compactDescription(description: string): string {
  return description
    .replace(/\b(the|a|an|basically|really|just|simply|generally)\b/giu, '')
    .replace(/\s+/gu, ' ')
    .replace(/\btoken usage\b/giu, 'tokens')
    .trim();
}
