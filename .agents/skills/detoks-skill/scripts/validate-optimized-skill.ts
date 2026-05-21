import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { estimateTokens } from './analyze-skill';

export interface ValidateOptimizedSkillArgs {
  sourceSkillRoot: string;
  optimizedSkillRoot: string;
}

export interface ValidationCheck {
  name: string;
  ok: boolean;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  tokenRatio: number;
  checks: ValidationCheck[];
}

async function exists(file: string): Promise<boolean> {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

function codeBlocks(text: string): string[] {
  return Array.from(
    text.matchAll(/(?:^|\r?\n)(`{3,})[^\r\n]*\r?\n[\s\S]*?\r?\n\1(?=\r?\n|$)/gu)
  ).map((match) => match[0].replace(/^\r?\n/u, ''));
}

function hasRequiredFrontmatter(frontmatter: string | undefined): boolean {
  if (!frontmatter) return false;
  const name = /^name:\s*(.+)$/imu.exec(frontmatter)?.[1]?.trim();
  const description = /^description:\s*(.+)$/imu.exec(frontmatter)?.[1]?.trim()?.replace(/^["'](.*)["']$/u, '$1');
  return Boolean(name) && Boolean(description?.startsWith('Use when'));
}

async function readAllMarkdown(root: string, current = root): Promise<string> {
  const entries = await readdir(current);
  const parts = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(current, entry);
      const info = await stat(fullPath);
      if (info.isDirectory()) return readAllMarkdown(root, fullPath);
      return entry.toLowerCase().endsWith('.md') ? readFile(fullPath, 'utf8') : '';
    })
  );
  return parts.join('\n');
}

/** Companion validator check declarations references ratio code fences. Report failed invariant. */
export async function validateOptimizedSkill(args: ValidateOptimizedSkillArgs): Promise<ValidationResult> {
  const sourceSkillPath = path.join(path.resolve(args.sourceSkillRoot), 'SKILL.md');
  const optimizedRoot = path.resolve(args.optimizedSkillRoot);
  const optimizedSkillPath = path.join(optimizedRoot, 'SKILL.md');
  const sourceSkill = await readFile(sourceSkillPath, 'utf8');
  const optimizedSkill = await readFile(optimizedSkillPath, 'utf8');
  const optimizedAll = await readAllMarkdown(optimizedRoot);
  const sourceBlocks = codeBlocks(sourceSkill);
  const sourceFrontmatter = /^---\r?\n[\s\S]*?\r?\n---/u.exec(sourceSkill)?.[0];
  const optimizedFrontmatter = /^---\r?\n[\s\S]*?\r?\n---/u.exec(optimizedSkill)?.[0];
  const tokenRatio = estimateTokens(optimizedSkill) / estimateTokens(sourceSkill);

  const references = await readdir(path.join(optimizedRoot, 'references')).catch(() => []);
  const checks: ValidationCheck[] = [
    {
      name: 'source-preserved',
      ok: await exists(sourceSkillPath),
      message: 'source SKILL.md must still exist'
    },
    {
      name: 'frontmatter-valid',
      ok: hasRequiredFrontmatter(optimizedFrontmatter),
      message: 'optimized SKILL.md must include name and Use when description frontmatter'
    },
    {
      name: 'frontmatter-declarations-preserved',
      ok: Boolean(sourceFrontmatter && optimizedFrontmatter && sourceFrontmatter === optimizedFrontmatter),
      message: 'optimized companion must copy agent-skill frontmatter declarations exactly'
    },
    {
      name: 'references-linked',
      ok: references.length > 0 && references.every((reference) => optimizedSkill.includes(`references/${reference}`)),
      message: 'optimized root must link each reference'
    },
    {
      name: 'optimized-root-token-ratio-under-1',
      ok: tokenRatio < 1,
      message: `optimized root/source root token ratio ${tokenRatio.toFixed(2)}`
    },
    {
      name: 'code-blocks-preserved',
      ok: sourceBlocks.every((block) => optimizedAll.includes(block)),
      message: 'all source fenced code blocks must appear exactly in optimized bundle'
    }
  ];

  return {
    ok: checks.every((check) => check.ok),
    tokenRatio,
    checks
  };
}
