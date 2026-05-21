import { mkdtemp, readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeSkill } from '../../../skills/detoks-skill/scripts/analyze-skill';
import { evolveCandidates } from '../../../skills/detoks-skill/scripts/evolve-candidates';
import { optimizeAgentSkillFrontmatterForContext } from '../../../skills/detoks-skill/scripts/optimize-agent-frontmatter';
import { renderOptimizedSkill } from '../../../skills/detoks-skill/scripts/render-optimized-skill';
import { validateOptimizedSkill } from '../../../skills/detoks-skill/scripts/validate-optimized-skill';

async function writeSampleSkill(root: string): Promise<string> {
  const skillRoot = path.join(root, 'verbose-skill');
  await import('node:fs/promises').then(async ({ mkdir, writeFile }) => {
    await mkdir(path.join(skillRoot, 'references'), { recursive: true });
    await writeFile(
      path.join(skillRoot, 'SKILL.md'),
      `---
name: verbose-skill
description: Use when verbose test skills need compression
---

# Verbose Skill

## Workflow

You should always make sure to inspect the source skill before changing anything.
You should always make sure to preserve code blocks exactly because scripts and commands must remain stable.
You should always make sure to run validation after writing generated output.
You should always make sure to report token savings and unresolved risks.

## Deterministic Process

1. Read all markdown files.
2. Count estimated tokens.
3. Write JSON report.
4. Validate output paths.

\`\`\`ts
const exactPath = "./scripts/example.ts";
console.log(exactPath);
\`\`\`
`,
      'utf8'
    );
  });

  return skillRoot;
}

describe('detoks-skill scripts', () => {
  it('analyzes token hotspots and deterministic workflow candidates', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'detoks-skill-analyze-'));
    const skillRoot = await writeSampleSkill(root);

    const report = await analyzeSkill(skillRoot);

    expect(report.skillName).toBe('verbose-skill');
    expect(report.files.some((file) => file.relativePath === 'SKILL.md')).toBe(true);
    expect(report.hotspots[0]?.relativePath).toBe('SKILL.md');
    expect(report.deterministicCandidates.some((candidate) => candidate.reason.includes('numbered workflow'))).toBe(true);
  });

  it('renders compact companion skill without mutating original source', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'detoks-skill-render-'));
    const skillRoot = await writeSampleSkill(root);
    const original = await readFile(path.join(skillRoot, 'SKILL.md'), 'utf8');
    const outputRoot = path.join(root, 'verbose-skill-detoks');

    const rendered = await renderOptimizedSkill({ sourceSkillRoot: skillRoot, outputSkillRoot: outputRoot });

    const after = await readFile(path.join(skillRoot, 'SKILL.md'), 'utf8');
    const optimized = await readFile(path.join(outputRoot, 'SKILL.md'), 'utf8');
    const workflow = await readFile(path.join(outputRoot, 'references', 'workflow.md'), 'utf8');

    expect(after).toBe(original);
    expect(rendered.outputSkillRoot).toBe(outputRoot);
    expect(optimized).toContain('name: verbose-skill');
    expect(optimized).toContain('description: Use when verbose test skills need compression');
    expect(optimized.length).toBeLessThan(original.length);
    expect(optimized).toContain('references/workflow.md');
    expect(workflow).toContain('Preserved Source');
    expect(workflow).toContain(original);
    expect(workflow).toContain('````markdown\n---\nname: verbose-skill');
  });

  it('validates optimized output and rejects unsafe code-block corruption', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'detoks-skill-validate-'));
    const skillRoot = await writeSampleSkill(root);
    const outputRoot = path.join(root, 'verbose-skill-detoks');
    await renderOptimizedSkill({ sourceSkillRoot: skillRoot, outputSkillRoot: outputRoot });

    const valid = await validateOptimizedSkill({ sourceSkillRoot: skillRoot, optimizedSkillRoot: outputRoot });
    expect(valid.ok).toBe(true);
    expect(valid.checks.some((check) => check.name === 'source-preserved' && check.ok)).toBe(true);
    expect(valid.checks.some((check) => check.name === 'frontmatter-declarations-preserved' && check.ok)).toBe(true);
    expect(valid.tokenRatio).toBeLessThan(1);

    await import('node:fs/promises').then(async ({ writeFile }) => {
      await writeFile(path.join(outputRoot, 'references', 'workflow.md'), 'missing exact code block', 'utf8');
    });
    const invalid = await validateOptimizedSkill({ sourceSkillRoot: skillRoot, optimizedSkillRoot: outputRoot });
    expect(invalid.ok).toBe(false);
    expect(invalid.checks.some((check) => check.name === 'code-blocks-preserved' && !check.ok)).toBe(true);
  });

  it('accepts CRLF frontmatter in any declaration order', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'detoks-skill-frontmatter-order-'));
    const skillRoot = path.join(root, 'ordered-skill');
    const outputRoot = path.join(root, 'ordered-skill-detoks');
    await import('node:fs/promises').then(async ({ mkdir, writeFile }) => {
      await mkdir(path.join(skillRoot, 'references'), { recursive: true });
      await mkdir(path.join(outputRoot, 'references'), { recursive: true });
      const source = [
        '---',
        'description: Use when declaration order differs',
        'name: ordered-skill',
        '---',
        '',
        '# Ordered Skill',
        '',
        '```sh',
        'echo exact',
        '```'
      ].join('\r\n');
      await writeFile(path.join(skillRoot, 'SKILL.md'), source, 'utf8');
      await writeFile(
        path.join(outputRoot, 'SKILL.md'),
        [
          '---',
          'description: Use when declaration order differs',
          'name: ordered-skill',
          '---',
          '',
          '# ordered-skill',
          '',
          '- `references/workflow.md`: source.'
        ].join('\r\n'),
        'utf8'
      );
      await writeFile(path.join(outputRoot, 'references', 'workflow.md'), source, 'utf8');
    });

    const valid = await validateOptimizedSkill({ sourceSkillRoot: skillRoot, optimizedSkillRoot: outputRoot });

    expect(valid.checks.some((check) => check.name === 'frontmatter-valid' && check.ok)).toBe(true);
    expect(valid.checks.some((check) => check.name === 'frontmatter-declarations-preserved' && check.ok)).toBe(true);
  });

  it('optimizes frontmatter context without changing Agent Skill declarations', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'detoks-skill-frontmatter-'));
    const skillRoot = await writeSampleSkill(root);
    const skillText = await readFile(path.join(skillRoot, 'SKILL.md'), 'utf8');

    const result = optimizeAgentSkillFrontmatterForContext(skillText);

    expect(result.originalFrontmatter).toBe('---\nname: verbose-skill\ndescription: Use when verbose test skills need compression\n---');
    expect(result.declarations).toMatchObject({ name: 'verbose-skill' });
    expect(result.declarationsUnchanged).toBe(true);
    expect(result.optimizedContext).toContain('frontmatter-ref:');
    expect(result.optimizedContext).toContain('declarations:preserved-exactly-in-SKILL.md');
    expect(result.reasonCodes).toContain('frontmatter-context-optimized');
  });

  it('can compress generated reference prose through the detoks-prompt CLI contract from remote main', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'detoks-skill-detoks-prompt-'));
    const skillRoot = await writeSampleSkill(root);
    const outputRoot = path.join(root, 'verbose-skill-detoks');
    const calls: Array<{ command: string; args: string[]; input: string }> = [];

    await renderOptimizedSkill({
      sourceSkillRoot: skillRoot,
      outputSkillRoot: outputRoot,
      compressReferencesWithDetoksPrompt: true,
      spawnFn: async (command, args, input) => {
        calls.push({ command, args, input });
        return { code: 0, stdout: `${input.replace('Generated companion', 'Companion')}\n`, stderr: '' };
      }
    });

    expect(calls[0]?.command).toBe('node');
    expect(calls[0]?.args).toEqual(['packages/cli/dist/utk.js', 'detoks-prompt', '--stdin', '--rate', '0.5']);
    expect(calls[0]?.input).toContain('Frontmatter Context Optimization');
    expect(await readFile(path.join(outputRoot, 'references', 'workflow.md'), 'utf8')).toContain('Companion');
  });

  it('evolves candidates and artifacts the best passing companion', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'detoks-skill-evolve-'));
    const skillRoot = await writeSampleSkill(root);
    const outputRoot = path.join(root, 'best-detoks');

    const calls: Array<{ command: string; args: string[]; input: string }> = [];
    const spawnFn = async (command: string, args: string[], input: string) => {
      calls.push({ command, args, input });
      return { code: 0, stdout: 'trace-opt ready', stderr: '' };
    };

    const result = await evolveCandidates({ sourceSkillRoot: skillRoot, outputRoot, iterations: 2, backend: 'trace', spawnFn });

    expect(result.best.score).toBeGreaterThan(0);
    expect(result.candidates).toHaveLength(2);
    expect(calls[0]?.args.join('\n')).toContain('from opto import trace');
    expect(calls[0]?.args.join('\n')).toContain('from opto.optimizers import OptoPrime');
    expect(calls[1]?.args.join('\n')).toContain('@trace.bundle');
    expect(calls[1]?.args.join('\n')).toContain('trace.node');
    await expect(stat(path.join(outputRoot, 'SKILL.md'))).resolves.toBeTruthy();
    await expect(stat(path.join(outputRoot, 'references', 'workflow.md'))).resolves.toBeTruthy();
  });

  it('can require real Agent Lightning backend instead of local imitation', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'detoks-skill-agent-lightning-'));
    const skillRoot = await writeSampleSkill(root);
    const outputRoot = path.join(root, 'best-detoks');
    const calls: Array<{ args: string[]; input: string }> = [];

    await evolveCandidates({
      sourceSkillRoot: skillRoot,
      outputRoot,
      iterations: 1,
      backend: 'agent-lightning',
      spawnFn: async (_command, args, input) => {
        calls.push({ args, input });
        return { code: 0, stdout: 'agentlightning ready', stderr: '' };
      }
    });

    expect(calls[0]?.args.join('\n')).toContain('import agentlightning as agl');
    expect(calls[1]?.args.join('\n')).toContain('InMemoryLightningStore');
    expect(calls[1]?.args.join('\n')).toContain('enqueue_rollout');
  });
});
