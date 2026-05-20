import { access, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(import.meta.dirname, '../../..');

async function readJson(file: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path.join(repoRoot, file), 'utf8')) as Record<string, unknown>;
}

async function readJsonAtPath(file: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
}

async function listFiles(root: string): Promise<string[]> {
  const entries = await readdir(root);
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(root, entry);
      const relativePath = path.relative(root, fullPath);
      const info = await stat(fullPath);

      if (!info.isDirectory()) return [relativePath];

      return (await listFiles(fullPath)).map((child) => path.join(relativePath, child));
    })
  );

  return files.flat().sort();
}

function parseSkillFrontmatter(skill: string): Record<string, string> {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(skill);
  expect(match, 'SKILL.md must start with YAML frontmatter').not.toBeNull();

  return Object.fromEntries(
    match![1]
      .split(/\r?\n/)
      .map((line) => /^([a-z-]+):\s*(.+)$/.exec(line))
      .filter((entry): entry is RegExpExecArray => entry !== null)
      .map((entry) => [entry[1], entry[2].replace(/^"(.*)"$/, '$1')])
  );
}

function assertCopilotHookConfig(config: Record<string, unknown>): void {
  expect(config.version).toBe(1);
  expect(config).toHaveProperty('hooks');
  expect(config).not.toHaveProperty('preToolUse');

  const hooks = config.hooks as Record<string, unknown>;
  expect(Array.isArray(hooks.preToolUse)).toBe(true);

  for (const hook of hooks.preToolUse as Array<Record<string, unknown>>) {
    expect(hook.type).toBe('command');
    expect(hook).not.toHaveProperty('name');
    expect(hook).not.toHaveProperty('args');
    expect(typeof hook.timeoutSec).toBe('number');
    expect(typeof hook.cwd).toBe('string');
    expect([hook.bash, hook.powershell, hook.command].some((value) => typeof value === 'string' && value.length > 0)).toBe(true);
  }
}

describe('package boundary', () => {
  it('exposes only the approved model proxy public CLI package', async () => {
    const rootPackage = await readJson('package.json');
    const packages = await readdir(path.join(repoRoot, 'packages'));

    expect(rootPackage).not.toHaveProperty('bin');
    expect(packages).not.toContain('mcp-server');
    expect(packages).toContain('detok-mcp');
    expect(packages).toContain('model-proxy');

    const modelProxyPackage = await readJson('packages/model-proxy/package.json');
    expect(modelProxyPackage).toMatchObject({
      name: '@utk/model-proxy',
      private: true,
      bin: {
        'utk-model-proxy': 'dist/server.js'
      }
    });
  });

  it('does not include the accidental VS Code extension package', async () => {
    const packages = await readdir(path.join(repoRoot, 'packages'));
    const lock = await readJson('package-lock.json');

    expect(packages).not.toContain('vscode-extension');
    expect(JSON.stringify(lock)).not.toContain('utk-vscode');
    expect(JSON.stringify(lock)).not.toContain('@types/vscode');
  });

  it('ships a UTK init agent skill for project-local schema seeding', async () => {
    const skillRoot = path.join(repoRoot, 'skills', 'utk-init');
    const skill = await readFile(path.join(skillRoot, 'SKILL.md'), 'utf8');
    const references = await readdir(path.join(skillRoot, 'references'));

    await access(path.join(skillRoot, 'agents', 'openai.yaml'));

    expect(skill).toContain('name: utk-init');
    expect(skill).toContain('description: Use when initializing Universal Token Killer schema artifacts');
    expect(skill).toContain('specific tool ids');
    expect(skill).toContain('descriptions or sample outputs');
    expect(skill).toContain('session-agents');
    expect(skill).toContain('session-skills');
    expect(skill).toContain('reason-with-lexicon');
    expect(skill).toContain('Do not create a public CLI or VS Code extension');
    expect(skill).toContain('the only local MCP helper is `detok`');
    expect(references.sort()).toEqual([
      'input-contract.md',
      'report.md',
      'schema-generation.md',
      'session-agents.md',
      'session-skills.md',
      'tool-discovery.md'
    ]);
  });

  it('ships a detoks agent skill for CLI-first prompt compression with MCP fallback', async () => {
    const skillRoot = path.join(repoRoot, 'skills', 'detoks');
    const skill = await readFile(path.join(skillRoot, 'SKILL.md'), 'utf8');
    const reference = await readFile(path.join(skillRoot, 'references', 'detok-mcp.md'), 'utf8');

    await access(path.join(skillRoot, 'agents', 'openai.yaml'));

    expect(skill).toContain('name: detoks');
    expect(skill).toContain('`detoks-prompt` CLI flow');
    expect(skill).toContain('node packages/cli/dist/utk.js detoks-prompt --file <path>');
    expect(skill).toContain('detok MCP server');
    expect(skill).toContain('LLMLingua-2');
    expect(skill).toContain('does not replace UTK raw artifact persistence');
    expect(reference).toContain('"forceTokens"');
    expect(reference).toContain('Do not compress before UTK has parsed schemas/templates');
  });

  it('packages every repo skill for agentskills.io and skills.sh discovery', async () => {
    await expect(access(path.join(repoRoot, 'agent-skills'))).rejects.toThrow();

    const skillsRoot = path.join(repoRoot, 'skills');
    const skillNames = (await readdir(skillsRoot)).sort();

    expect(skillNames).toEqual(['detoks', 'detoks-skill', 'utk', 'utk-init']);

    for (const skillName of skillNames) {
      const skillRoot = path.join(skillsRoot, skillName);
      const skill = await readFile(path.join(skillRoot, 'SKILL.md'), 'utf8');
      const metadata = parseSkillFrontmatter(skill);
      const openAiMetadata = await readFile(path.join(skillRoot, 'agents', 'openai.yaml'), 'utf8');
      const references = await readdir(path.join(skillRoot, 'references'));

      expect(metadata.name).toBe(skillName);
      expect(metadata.name).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(metadata.description).toBeTruthy();
      expect(metadata.description.length).toBeLessThanOrEqual(1024);
      expect(metadata.description).toContain('Use when');
      expect(references.length).toBeGreaterThan(0);
      expect(openAiMetadata).toContain('interface:');
      expect(openAiMetadata).toContain('display_name:');
      expect(openAiMetadata).toContain('short_description:');
      expect(openAiMetadata).toContain(`Use $${skillName}`);
    }
  });

  it('exposes UTK as a GitHub Copilot plugin marketplace bundle', async () => {
    const marketplace = await readJson('.github/plugin/marketplace.json');
    const plugins = marketplace.plugins as Array<Record<string, unknown>>;
    const plugin = plugins.find((entry) => entry.name === 'universal-token-killer');
    const pluginRoot = path.join(repoRoot, '.github', 'plugins', 'universal-token-killer');
    const manifest = await readJsonAtPath(path.join(pluginRoot, 'plugin.json'));
    const githubManifest = await readJsonAtPath(path.join(pluginRoot, '.github', 'plugin', 'plugin.json'));
    const mcpConfig = await readJsonAtPath(path.join(pluginRoot, '.mcp.json'));
    const hooksConfig = await readJsonAtPath(path.join(pluginRoot, 'hooks', 'hooks.json'));
    const pluginHookRunner = await readFile(path.join(pluginRoot, 'hooks', 'detokPreToolUseHook.js'), 'utf8');
    const agents = await readdir(path.join(pluginRoot, 'agents'));

    expect(marketplace.name).toBe('universal-token-killer');
    expect(plugin).toMatchObject({
      source: './.github/plugins/universal-token-killer',
      agents: './agents',
      skills: './skills',
      mcpServers: '.mcp.json',
      strict: true
    });
    expect(manifest).toMatchObject({
      name: 'universal-token-killer',
      agents: ['./agents'],
      skills: ['./skills/utk', './skills/utk-init', './skills/detoks', './skills/detoks-skill'],
      mcpServers: '.mcp.json',
      strict: true
    });
    expect(githubManifest).toEqual(manifest);
    expect((mcpConfig.mcpServers as Record<string, unknown>).detok).toMatchObject({
      type: 'stdio',
      command: 'node',
      cwd: '${workspaceFolder}'
    });
    assertCopilotHookConfig(hooksConfig);
    expect(JSON.stringify(hooksConfig)).toContain('hooks/detokPreToolUseHook.js');
    expect(pluginHookRunner).toContain("packages', 'copilot-hook', 'dist', 'detokPreToolUseHook.js");
    expect(pluginHookRunner).toContain("process.stdout.write('{}')");
    expect(agents).toEqual(['utk-mediator.agent.md']);
  });

  it('registers a repo-local Copilot CLI detok preToolUse hook', async () => {
    const hookConfig = await readJson('.github/hooks/utk-detok-inputs.json');

    assertCopilotHookConfig(hookConfig);
    expect(JSON.stringify(hookConfig)).toContain('packages/copilot-hook/dist/detokPreToolUseHook.js');
  });

  it('keeps Copilot plugin skill copies synchronized with canonical agent skills', async () => {
    const canonicalRoot = path.join(repoRoot, 'skills');
    const pluginSkillsRoot = path.join(repoRoot, '.github', 'plugins', 'universal-token-killer', 'skills');
    const skillNames = (await readdir(canonicalRoot)).sort();

    for (const skillName of skillNames) {
      const canonicalSkillRoot = path.join(canonicalRoot, skillName);
      const pluginSkillRoot = path.join(pluginSkillsRoot, skillName);
      const canonicalFiles = await listFiles(canonicalSkillRoot);
      const pluginFiles = await listFiles(pluginSkillRoot);

      expect(pluginFiles).toEqual(canonicalFiles);

      for (const file of canonicalFiles) {
        await expect(readFile(path.join(pluginSkillRoot, file), 'utf8')).resolves.toBe(
          await readFile(path.join(canonicalSkillRoot, file), 'utf8')
        );
      }
    }
  });

  it('ships detoks-skill with references, scripts, local copy, and AgentEvals contract', async () => {
    const skillRoot = path.join(repoRoot, 'skills', 'detoks-skill');
    const localRoot = path.join(repoRoot, '.agents', 'skills', 'detoks-skill');
    const skill = await readFile(path.join(skillRoot, 'SKILL.md'), 'utf8');
    const references = (await readdir(path.join(skillRoot, 'references'))).sort();
    const scripts = (await readdir(path.join(skillRoot, 'scripts'))).sort();
    const evalYaml = await readFile(path.join(skillRoot, 'evals', 'EVAL.yaml'), 'utf8');

    await access(path.join(skillRoot, 'agents', 'openai.yaml'));
    await access(path.join(localRoot, 'SKILL.md'));

    expect(skill.length).toBeLessThan(1800);
    expect(skill).toContain('name: detoks-skill');
    expect(skill).toContain('references/workflow.md');
    expect(references).toEqual(['compression-strategies.md', 'evals.md', 'script-extraction.md', 'workflow.md']);
    expect(scripts).toEqual(['analyze-skill.ts', 'evolve-candidates.ts', 'optimize-agent-frontmatter.ts', 'render-optimized-skill.ts', 'validate-optimized-skill.ts']);
    expect(evalYaml).toContain('code_judge');
    expect(evalYaml).toContain('frontmatter-declarations-preserved');
    expect(evalYaml).toContain('tool_trajectory');
    expect(evalYaml).toContain('execution_metrics');
  });
});
