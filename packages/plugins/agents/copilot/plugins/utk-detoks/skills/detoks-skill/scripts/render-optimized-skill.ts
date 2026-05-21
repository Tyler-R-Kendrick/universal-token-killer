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

function fenceFor(text: string): string {
  const longest = Math.max(2, ...Array.from(text.matchAll(/`+/gu)).map((match) => match[0].length));
  return '`'.repeat(longest + 1);
}

function defaultSpawn(command: string, args: string[], input: string): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`Command timed out: ${command} ${args.join(' ')}`));
    }, 30_000);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('close', (code) => {
      clearTimeout(timeout);
      resolve({ code, stdout, stderr });
    });
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

/** Companion renderer write token-light skill. Preserve original source skill unchanged. */
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

  const root = `${frontmatter.originalFrontmatter}\n\n# ${optimizedName}\n\nToken-light companion. Original skill = source truth.\n\n## Load Map\n\n- \`references/workflow.md\`: source, migration, checks.\n- \`references/hotspots.md\`: token hotspots, script candidates.\n\n## Rules\n\n1. Exact behavior needed? Read original first.\n2. Preserve code, commands, paths, URLs, YAML exactly.\n3. Run scripts before success report.\n`;

  const hotspots = analysis.hotspots
    .map((file) => `- ${file.relativePath}: ~${file.estimatedTokens} tok, ${file.bytes} bytes`)
    .join('\n');
  const candidates =
    analysis.deterministicCandidates
      .map((candidate) => `- ${candidate.relativePath}: ${candidate.reason}\n\n  ${candidate.excerpt.replace(/\n/g, '\n  ')}`)
      .join('\n') || '- No script candidates.';

  const workflowProse = await maybeCompressReference(
    `# Workflow\n\nCompanion for \`${sourceName}\`.\n\nSource SHA256: \`${sha256(sourceSkill)}\`\nCandidate: ${args.candidateLabel ?? 'default'}\n\n## Frontmatter Context Optimization\n\n${frontmatter.optimizedContext}\n\n## Validation\n\n- Source skill unchanged: \`${sourceSkillRoot}\`.\n- Optimized root: ~${estimateTokens(root)} tok.\n- Source root: ~${estimateTokens(sourceSkill)} tok.\n- Frontmatter declarations copied exactly.\n- Code blocks below copied exactly.\n`,
    args
  );
  const fence = fenceFor(sourceSkill);
  const workflow = `${workflowProse}\n## Preserved Source\n\n${fence}markdown\n${sourceSkill}\n${fence}\n`;

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
