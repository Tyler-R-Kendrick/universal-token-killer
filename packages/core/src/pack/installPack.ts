import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { atomicWriteFile } from '../artifact/atomicWrite.js';
import { canonicalJson, contentHash } from '../artifact/canonical.js';
import { normalizeToolId } from '../artifact/manifest.js';
import { safeJoin } from '../security/pathSafety.js';
import { fetchPackToTempDir, type PackFetcher } from './fetcher.js';
import { lintPack, type LintOptions, type LintReport, formatLintReport } from './lintPack.js';
import { loadPack } from './loadPack.js';
import { readLockfile, writeLockfile } from './lockfile.js';
import { addPackRegistryBlocks, removePackRegistryBlocks } from './registryRewrite.js';
import { describePackSource } from './sources.js';
import type { InstalledPack, LoadedPack, PackGrammarRecord, PackPluginRecord, PackSource } from './types.js';

export type InstallPackOptions = {
  fetcher?: PackFetcher;
  force?: boolean;
  now?: () => Date;
  skipLint?: boolean;
  lintOptions?: LintOptions;
};

export class PackLintError extends Error {
  public readonly report: LintReport;
  constructor(report: LintReport, packLabel: string) {
    super(`Pack failed linting (${report.errorCount} error(s)):\n${formatLintReport(report, packLabel)}`);
    this.name = 'PackLintError';
    this.report = report;
  }
}

export async function installPack(workspaceRoot: string, source: PackSource, options: InstallPackOptions = {}): Promise<InstalledPack> {
  const fetcher = options.fetcher ?? fetchPackToTempDir;
  const fetched = await fetcher(source, workspaceRoot);
  if (!options.skipLint) {
    const report = await lintPack(fetched.dir, options.lintOptions);
    if (!report.ok) {
      throw new PackLintError(report, describePackSource(source));
    }
  }
  const pack = await loadPack(fetched.dir);

  const existing = await readLockfile(workspaceRoot);
  const conflict = existing.find((entry) => entry.name === pack.manifest.pack.name);
  if (conflict && !options.force) {
    throw new Error(`Pack ${pack.manifest.pack.name} is already installed (use force to overwrite)`);
  }
  if (conflict) {
    await uninstallPackByName(workspaceRoot, conflict.name);
  }

  const packsBase = safeJoin(workspaceRoot, '.utk', 'packs');
  const packDestination = safeJoin(packsBase, pack.manifest.pack.name);
  await mkdir(path.dirname(packDestination), { recursive: true });
  await rm(packDestination, { recursive: true, force: true });
  await cp(pack.rootDir, packDestination, { recursive: true });

  try {
    await addPackRegistryBlocks(workspaceRoot, pack.manifest.pack.name, pack.tools);
    await installPackGrammars(workspaceRoot, pack.grammars);
    const templateRecords = await persistTemplateDescriptors(workspaceRoot, pack);

    const installedAt = (options.now ?? (() => new Date()))().toISOString();
    const installed: InstalledPack = {
      name: pack.manifest.pack.name,
      version: pack.manifest.pack.version,
      source: describePackSource(source),
      revision: fetched.revision,
      contentHash: contentHash(canonicalJson({
        manifest: pack.manifest,
        tools: pack.tools.map((tool) => tool.source),
        grammars: pack.grammars.map((grammar) => ({ tool: grammar.tool, field: grammar.field, lark: grammar.lark })),
        templates: pack.templates.map((template) => template.source),
        plugins: pack.plugins.map((plugin) => pluginContentForHash(plugin))
      }), 16),
      installedAt,
      tools: pack.tools.map((tool) => tool.entry.id),
      templates: templateRecords,
      grammars: pack.grammars.map((grammar) => ({
        tool: grammar.tool,
        field: grammar.field,
        larkHash: grammar.larkHash
      })),
      plugins: pack.plugins.map((plugin) => pluginLockEntry(plugin))
    };

    const remaining = existing.filter((entry) => entry.name !== installed.name);
    await writeLockfile(workspaceRoot, [...remaining, installed]);
    return installed;
  } catch (error) {
    try {
      await rollbackInstall(workspaceRoot, pack);
    } catch {
      /* Rollback is best-effort; surface the original failure either way. */
    }
    throw error;
  }
}

function pluginContentForHash(plugin: PackPluginRecord): Record<string, unknown> {
  if ('grammar' in plugin) {
    return { entry: plugin.entry, lark: plugin.grammar.lark };
  }
  return { entry: plugin.entry };
}

function pluginLockEntry(plugin: PackPluginRecord): InstalledPack['plugins'][number] {
  if ('grammar' in plugin) {
    return {
      type: 'serialization',
      id: plugin.entry.id,
      larkHash: plugin.grammar.larkHash
    };
  }
  return {
    type: 'agent',
    id: plugin.entry.id,
    target: plugin.entry.target
  };
}

async function rollbackInstall(workspaceRoot: string, pack: LoadedPack): Promise<void> {
  // Rollback is best-effort: each step's failure must not stop the others.
  const steps: Array<() => Promise<void>> = [
    () => removePackRegistryBlocks(workspaceRoot, pack.manifest.pack.name),
    ...pack.grammars.map((grammar) => async () => {
      await removeLarkArtifact(workspaceRoot, grammar.tool, grammar.field);
    }),
    () => rm(safeJoin(workspaceRoot, '.utk', 'cache', 'templates', `${pack.manifest.pack.name}.json`), { force: true }),
    () => rm(safeJoin(workspaceRoot, '.utk', 'packs', pack.manifest.pack.name), { recursive: true, force: true })
  ];
  for (const step of steps) {
    try {
      await step();
    } catch {
      /* swallow — best-effort rollback */
    }
  }
}

export async function uninstallPack(workspaceRoot: string, name: string): Promise<void> {
  await uninstallPackByName(workspaceRoot, name);
}

async function uninstallPackByName(workspaceRoot: string, name: string): Promise<void> {
  const existing = await readLockfile(workspaceRoot);
  const target = existing.find((entry) => entry.name === name);
  if (!target) {
    throw new Error(`Pack ${name} is not installed`);
  }
  await removePackRegistryBlocks(workspaceRoot, name);
  for (const grammar of target.grammars) {
    await removeLarkArtifact(workspaceRoot, grammar.tool, grammar.field);
  }
  await rm(safeJoin(workspaceRoot, '.utk', 'packs', name), { recursive: true, force: true });
  await rm(safeJoin(workspaceRoot, '.utk', 'cache', 'templates', `${name}.json`), { force: true });
  const remaining = existing.filter((entry) => entry.name !== name);
  await writeLockfile(workspaceRoot, remaining);
}

export async function listInstalledPacks(workspaceRoot: string): Promise<InstalledPack[]> {
  return await readLockfile(workspaceRoot);
}

async function installPackGrammars(workspaceRoot: string, grammars: PackGrammarRecord[]): Promise<void> {
  for (const grammar of grammars) {
    const toolId = normalizeToolId(grammar.tool);
    const fieldId = normalizeToolId(grammar.field);
    const larkPath = safeJoin(workspaceRoot, '.utk', 'tools', toolId, 'fields', `${fieldId}.lark`);
    await mkdir(path.dirname(larkPath), { recursive: true });
    // Atomic write — the .lark is read by the constrained decoder at every
    // mediation; a torn write would surface as an unparseable grammar.
    await atomicWriteFile(larkPath, grammar.lark);
  }
}

async function removeLarkArtifact(workspaceRoot: string, tool: string, field: string): Promise<void> {
  const toolId = normalizeToolId(tool);
  const fieldId = normalizeToolId(field);
  const larkPath = safeJoin(workspaceRoot, '.utk', 'tools', toolId, 'fields', `${fieldId}.lark`);
  await rm(larkPath, { force: true });
}

async function persistTemplateDescriptors(workspaceRoot: string, pack: LoadedPack): Promise<string[]> {
  const ids: string[] = [];
  for (const template of pack.templates) {
    ids.push(template.entry.id);
  }
  if (ids.length === 0) return ids;
  const descriptorList = pack.templates.map((template) => ({ id: template.entry.id, language: template.entry.language, file: template.entry.file }));
  const cacheDir = safeJoin(workspaceRoot, '.utk', 'cache', 'templates');
  await mkdir(cacheDir, { recursive: true });
  const manifestPath = safeJoin(cacheDir, `${pack.manifest.pack.name}.json`);
  await atomicWriteFile(manifestPath, canonicalJson({ pack: pack.manifest.pack.name, templates: descriptorList }));
  return ids;
}
