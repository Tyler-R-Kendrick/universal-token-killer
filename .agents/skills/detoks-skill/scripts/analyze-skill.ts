import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

export interface SkillFileReport {
  relativePath: string;
  bytes: number;
  estimatedTokens: number;
  headings: string[];
}

export interface DeterministicCandidate {
  relativePath: string;
  reason: string;
  excerpt: string;
}

export interface SkillAnalysisReport {
  skillName: string;
  skillRoot: string;
  totalEstimatedTokens: number;
  files: SkillFileReport[];
  hotspots: SkillFileReport[];
  deterministicCandidates: DeterministicCandidate[];
}

/** Estimate LLM tokens cheaply for skill budget comparisons. */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.trim().split(/\s+/u).filter(Boolean).length * 1.33));
}

function parseSkillName(skillText: string, fallback: string): string {
  return /^name:\s*(.+)$/mu.exec(skillText)?.[1]?.trim() ?? fallback;
}

async function listMarkdown(root: string, current = root): Promise<string[]> {
  const entries = await readdir(current);
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(current, entry);
      const info = await stat(fullPath);
      if (info.isDirectory()) return listMarkdown(root, fullPath);
      return entry.toLowerCase().endsWith('.md') ? [path.relative(root, fullPath)] : [];
    })
  );

  return files.flat().sort();
}

function findDeterministicCandidates(relativePath: string, text: string): DeterministicCandidate[] {
  const candidates: DeterministicCandidate[] = [];
  const numbered = text.match(/(?:^|\n)(?:\d+\.\s+.+\n?){3,}/mu);
  if (numbered) {
    candidates.push({
      relativePath,
      reason: 'numbered workflow can become parameterized script',
      excerpt: numbered[0].trim().slice(0, 320)
    });
  }

  const repeatedValidation = text.match(/(?:validate|check|count|scan|compare|copy|sync|write|report).{0,80}/giu);
  if ((repeatedValidation?.length ?? 0) >= 4) {
    candidates.push({
      relativePath,
      reason: 'repeated deterministic verbs can become script operations',
      excerpt: repeatedValidation!.slice(0, 4).join(' | ')
    });
  }

  return candidates;
}

/** Read markdown once, report token hotspots plus scriptable workflow candidates. */
export async function analyzeSkill(skillRoot: string): Promise<SkillAnalysisReport> {
  const absoluteRoot = path.resolve(skillRoot);
  const markdown = await listMarkdown(absoluteRoot);
  const markdownRecords = await Promise.all(
    markdown.map(async (relativePath) => {
      const text = await readFile(path.join(absoluteRoot, relativePath), 'utf8');
      return { relativePath, text };
    })
  );
  const files = markdownRecords.map(({ relativePath, text }) => {
      return {
        relativePath,
        bytes: Buffer.byteLength(text, 'utf8'),
        estimatedTokens: estimateTokens(text),
        headings: Array.from(text.matchAll(/^#{1,6}\s+(.+)$/gmu)).map((match) => match[1]!.trim())
      };
    });

  const sourceSkill = markdownRecords.find((record) => record.relativePath === 'SKILL.md')?.text ?? '';
  const deterministicCandidates = markdownRecords.flatMap(({ relativePath, text }) =>
    findDeterministicCandidates(relativePath, text)
  );

  return {
    skillName: parseSkillName(sourceSkill, path.basename(absoluteRoot)),
    skillRoot: absoluteRoot,
    totalEstimatedTokens: files.reduce((sum, file) => sum + file.estimatedTokens, 0),
    files,
    hotspots: [...files].sort((left, right) => right.estimatedTokens - left.estimatedTokens).slice(0, 5),
    deterministicCandidates
  };
}
