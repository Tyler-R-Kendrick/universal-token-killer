import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { atomicWriteFile } from '../artifact/atomicWrite.js';
import { canonicalJson } from '../artifact/canonical.js';
import { normalizeToolId } from '../artifact/manifest.js';
import { safeJoin } from '../security/pathSafety.js';
import { addPackRegistryBlocks, removePackRegistryBlocks } from './registryRewrite.js';
import type { InstalledPack, LoadedPack, PackGrammarRecord } from './types.js';

export async function stagePackDirectory(workspaceRoot: string, pack: LoadedPack): Promise<void> {
  const packDestination = packDirectoryPath(workspaceRoot, pack.manifest.pack.name);
  await mkdir(path.dirname(packDestination), { recursive: true });
  await rm(packDestination, { recursive: true, force: true });
  await cp(pack.rootDir, packDestination, { recursive: true });
}

export async function persistPackInstallArtifacts(workspaceRoot: string, pack: LoadedPack): Promise<{ templateIds: string[] }> {
  await addPackRegistryBlocks(workspaceRoot, pack.manifest.pack.name, pack.tools);
  await installPackGrammars(workspaceRoot, pack.grammars);
  return { templateIds: await persistTemplateDescriptors(workspaceRoot, pack) };
}

export async function rollbackPackInstall(workspaceRoot: string, pack: LoadedPack): Promise<void> {
  await bestEffort([
    () => removePackRegistryBlocks(workspaceRoot, pack.manifest.pack.name),
    ...pack.grammars.map((grammar) => async () => removeLarkArtifact(workspaceRoot, grammar.tool, grammar.field)),
    () => removeTemplateDescriptor(workspaceRoot, pack.manifest.pack.name),
    () => rm(packDirectoryPath(workspaceRoot, pack.manifest.pack.name), { recursive: true, force: true })
  ]);
}

export async function removeInstalledPackArtifacts(workspaceRoot: string, pack: Pick<InstalledPack, 'name' | 'grammars'>): Promise<void> {
  await removePackRegistryBlocks(workspaceRoot, pack.name);
  for (const grammar of pack.grammars) {
    await removeLarkArtifact(workspaceRoot, grammar.tool, grammar.field);
  }
  await rm(packDirectoryPath(workspaceRoot, pack.name), { recursive: true, force: true });
  await removeTemplateDescriptor(workspaceRoot, pack.name);
}

async function bestEffort(steps: Array<() => Promise<void>>): Promise<void> {
  for (const step of steps) {
    try {
      await step();
    } catch {
      /* Rollback is best-effort: one failure must not hide other cleanup. */
    }
  }
}

async function installPackGrammars(workspaceRoot: string, grammars: PackGrammarRecord[]): Promise<void> {
  for (const grammar of grammars) {
    const larkPath = larkArtifactPath(workspaceRoot, grammar.tool, grammar.field);
    await mkdir(path.dirname(larkPath), { recursive: true });
    await atomicWriteFile(larkPath, grammar.lark);
  }
}

async function removeLarkArtifact(workspaceRoot: string, tool: string, field: string): Promise<void> {
  await rm(larkArtifactPath(workspaceRoot, tool, field), { force: true });
}

function larkArtifactPath(workspaceRoot: string, tool: string, field: string): string {
  return safeJoin(workspaceRoot, '.utk', 'tools', normalizeToolId(tool), 'fields', `${normalizeToolId(field)}.lark`);
}

async function persistTemplateDescriptors(workspaceRoot: string, pack: LoadedPack): Promise<string[]> {
  const ids = pack.templates.map((template) => template.entry.id);
  if (ids.length === 0) return ids;

  const descriptorList = pack.templates.map((template) => ({
    id: template.entry.id,
    language: template.entry.language,
    file: template.entry.file
  }));
  await mkdir(templateDescriptorRoot(workspaceRoot), { recursive: true });
  await atomicWriteFile(templateDescriptorPath(workspaceRoot, pack.manifest.pack.name), canonicalJson({
    pack: pack.manifest.pack.name,
    templates: descriptorList
  }));
  return ids;
}

async function removeTemplateDescriptor(workspaceRoot: string, packName: string): Promise<void> {
  await rm(templateDescriptorPath(workspaceRoot, packName), { force: true });
}

function packDirectoryPath(workspaceRoot: string, packName: string): string {
  return safeJoin(safeJoin(workspaceRoot, '.utk', 'packs'), packName);
}

function templateDescriptorPath(workspaceRoot: string, packName: string): string {
  return safeJoin(templateDescriptorRoot(workspaceRoot), `${packName}.json`);
}

function templateDescriptorRoot(workspaceRoot: string): string {
  return safeJoin(workspaceRoot, '.utk', 'cache', 'templates');
}
