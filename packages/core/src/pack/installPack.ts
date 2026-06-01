import { fetchPackToTempDir, type PackFetcher } from './fetcher.js';
import {
  persistPackInstallArtifacts,
  removeInstalledPackArtifacts,
  rollbackPackInstall,
  stagePackDirectory
} from './installPackArtifacts.js';
import { createInstalledPackRecord } from './installPackRecord.js';
import { lintPack, type LintOptions, type LintReport, formatLintReport } from './lintPack.js';
import { loadPack } from './loadPack.js';
import { readLockfile, writeLockfile } from './lockfile.js';
import { describePackSource } from './sources.js';
import type { InstalledPack, PackSource } from './types.js';

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

  await stagePackDirectory(workspaceRoot, pack);

  try {
    const { templateIds } = await persistPackInstallArtifacts(workspaceRoot, pack);
    const installed = createInstalledPackRecord(pack, {
      source: describePackSource(source),
      revision: fetched.revision,
      installedAt: (options.now ?? (() => new Date()))().toISOString(),
      templateIds
    });

    const remaining = existing.filter((entry) => entry.name !== installed.name);
    await writeLockfile(workspaceRoot, [...remaining, installed]);
    return installed;
  } catch (error) {
    try {
      await rollbackPackInstall(workspaceRoot, pack);
    } catch {
      /* Rollback is best-effort; surface the original failure either way. */
    }
    throw error;
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
  await removeInstalledPackArtifacts(workspaceRoot, target);
  const remaining = existing.filter((entry) => entry.name !== name);
  await writeLockfile(workspaceRoot, remaining);
}

export async function listInstalledPacks(workspaceRoot: string): Promise<InstalledPack[]> {
  return await readLockfile(workspaceRoot);
}
