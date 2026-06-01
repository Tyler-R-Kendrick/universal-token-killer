import { readFile } from 'node:fs/promises';
import { parse } from 'smol-toml';
import { safeJoin } from '../security/pathSafety.js';
import { normalizeManifest } from './packManifest.js';
import type { LintFinding } from './lintPackTypes.js';
import type { UtkPackManifest } from './types.js';

export function lintRecommendedManifestFields(manifest: UtkPackManifest, findings: LintFinding[]): void {
  if (!manifest.pack.description) {
    findings.push({ severity: 'warning', code: 'pack/manifest/missing-description', message: 'pack.description is recommended', file: 'utk.pack.toml' });
  }
  if (!manifest.pack.license) {
    findings.push({ severity: 'warning', code: 'pack/manifest/missing-license', message: 'pack.license is recommended', file: 'utk.pack.toml' });
  }
  if (!manifest.pack.homepage) {
    findings.push({ severity: 'info', code: 'pack/manifest/missing-homepage', message: 'pack.homepage helps consumers find documentation', file: 'utk.pack.toml' });
  }
  if (!manifest.compatibility?.utk) {
    findings.push({
      severity: 'warning',
      code: 'pack/manifest/missing-utk-compat',
      message: 'compatibility.utk is recommended so installers can verify @utk/core version',
      file: 'utk.pack.toml'
    });
  }
}

export async function readManifestForLint(packDir: string, findings: LintFinding[]): Promise<UtkPackManifest | undefined> {
  const manifestPath = safeJoin(packDir, 'utk.pack.toml');
  let text: string;
  try {
    text = await readFile(manifestPath, 'utf8');
  } catch (error) {
    recordManifestReadFailure(error as NodeJS.ErrnoException, findings);
    return undefined;
  }

  let raw: Record<string, unknown>;
  try {
    raw = parse(text) as Record<string, unknown>;
  } catch (error) {
    findings.push({ severity: 'error', code: 'pack/manifest/parse', message: `manifest is not valid TOML: ${(error as Error).message}`, file: 'utk.pack.toml' });
    return undefined;
  }

  try {
    return normalizeManifest(raw);
  } catch (error) {
    const message = (error as Error).message;
    findings.push({
      severity: 'error',
      code: message.includes('.module is not supported for serialization plugins') ? 'pack/plugins/module-not-supported' : 'pack/manifest/schema',
      message,
      file: 'utk.pack.toml'
    });
    return undefined;
  }
}

function recordManifestReadFailure(error: NodeJS.ErrnoException, findings: LintFinding[]): void {
  if (error.code === 'ENOENT') {
    findings.push({ severity: 'error', code: 'pack/manifest/missing', message: 'utk.pack.toml not found at pack root', file: 'utk.pack.toml' });
    return;
  }
  findings.push({
    severity: 'error',
    code: 'pack/manifest/unreadable',
    message: `failed to read utk.pack.toml: ${error.message}`,
    file: 'utk.pack.toml'
  });
}
