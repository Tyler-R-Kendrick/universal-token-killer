import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { analyzeSkill, estimateTokens } from './analyze-skill';
import { optimizeAgentSkillFrontmatterForContext } from './optimize-agent-frontmatter';

export interface RenderOptimizedSkillArgs {
  sourceSkillRoot: string;
  outputSkillRoot: string;
  candidateLabel?: string;
  compressReferencesWithDetoksPrompt?: boolean;
  detoksPromptCommand?: { command: string; args: string[] };
  spawnFn?: SpawnLike;
}

export interface RenderOptimizedSkillResult {
  outputSkillRoot: string;
  sourceSkillName: string;
  optimizedSkillName: string;
  sourceRootTokens: number;
  optimizedRootTokens: number;
}

export type SpawnLike = (command: string, args: string[], input: string) => Promise<{ code: number | null; stdout: string; stderr: string }>;

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function defaultSpawn(command: string, args: string[], input: string): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(input);
  });
}

async function maybeCompressReference(text: string, args: RenderOptimizedSkillArgs): Promise<string> {
  if (!args.compressReferencesWithDetoksPrompt) return text;
  const command = args.detoksPromptCommand ?? {
    command: 'node',
    args: ['packages/cli/dist/utk.js', 'detoks-prompt', '--stdin', '--rate', '0.5']
  };
  const result = await (args.spawnFn ?? defaultSpawn)(command.command, command.args, text);
  if (result.code !== 0 || !result.stdout.trim()) {
    throw new Error(`detoks-prompt failed while compressing reference prose: ${result.stderr || result.stdout}`);
  }
  return result.stdout.replace(/\s+$/u, '\n');
}

export async function renderOptimizedSkill(args: RenderOptimizedSkillArgs): Promise<RenderOptimizedSkillResult> {
  const sourceSkillRoot = path.resolve(args.sourceSkillRoot);
  const outputSkillRoot = path.resolve(args.outputSkillRoot);
  if (sourceSkillRoot === outputSkillRoot) {
    throw new Error('outputSkillRoot must differ from sourceSkillRoot');
  }

  const analysis = await analyzeSkill(sourceSkillRoot);
  const sourceSkill = await readFile(path.join(sourceSkillRoot, 'SKILL.md'), 'utf8');
  const frontmatter = optimizeAgentSkillFrontmatterForContext(sourceSkill);
  const sourceName = frontmatter.declarations.name ?? analysis.skillName;
  const optimizedName = sourceName;

  await mkdir(path.join(outputSkillRoot, 'references'), { recursive: true });
  await mkdir(path.join(outputSkillRoot, 'scripts'), { recursive: true });

  const root = `${frontmatter.originalFrontmatter}\n\n# ${optimizedName}\n\nToken-optimized companion. Original skill remains source of truth.\n\n## Load Map\n\n- \`references/workflow.md\`: preserved source, migration notes, validation checklist.\n- \`references/hotspots.md\`: token hotspots and deterministic script candidates.\n\n## Rules\n\n1. Read original skill first when exact behavior matters.\n2. Preserve code, commands, paths, URLs, and YAML exactly.\n3. Use scripts for repeatable checks before reporting success.\n`;

  const hotspots = analysis.hotspots
    .map((file) => `- ${file.relativePath}: ~${file.estimatedTokens} tokens, ${file.bytes} bytes`)
    .join('\n');
  const candidates =
    analysis.deterministicCandidates
      .map((candidate) => `- ${candidate.relativePath}: ${candidate.reason}\n\n  ${candidate.excerpt.replace(/\n/g, '\n  ')}`)
      .join('\n') || '- No deterministic script candidates found.';

  const workflow = await maybeCompressReference(
    `# Workflow\n\nGenerated companion for \`${sourceName}\`.\n\nSource SHA256: \`${sha256(sourceSkill)}\`\nCandidate: ${args.candidateLabel ?? 'default'}\n\n## Frontmatter Context Optimization\n\n${frontmatter.optimizedContext}\n\n## Validation\n\n- Source skill stays unchanged in \`${sourceSkillRoot}\`.\n- Optimized root token estimate: ${estimateTokens(root)}.\n- Source root token estimate: ${estimateTokens(sourceSkill)}.\n- Frontmatter declarations are copied exactly, not rewritten.\n- Code blocks below are copied exactly for preservation checks.\n\n## Preserved Source\n\n\`\`\`markdown\n${sourceSkill}\n\`\`\`\n`,
    args
  );

  const hotspotReference = `# Hotspots\n\n## Token Hotspots\n\n${hotspots}\n\n## Script Candidates\n\n${candidates}\n`;

  await writeFile(path.join(outputSkillRoot, 'SKILL.md'), root, 'utf8');
  await writeFile(path.join(outputSkillRoot, 'references', 'workflow.md'), workflow, 'utf8');
  await writeFile(path.join(outputSkillRoot, 'references', 'hotspots.md'), hotspotReference, 'utf8');

  return {
    outputSkillRoot,
    sourceSkillName: sourceName,
    optimizedSkillName: optimizedName,
    sourceRootTokens: estimateTokens(sourceSkill),
    optimizedRootTokens: estimateTokens(root)
  };
}
