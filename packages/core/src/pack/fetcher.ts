import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, readdir, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type { PackSource } from './types.js';

const execFileAsync = promisify(execFile);

export type PackFetcher = (source: PackSource, workspaceRoot: string) => Promise<{ dir: string; revision: string }>;

export async function fetchPackToTempDir(source: PackSource, workspaceRoot: string): Promise<{ dir: string; revision: string }> {
  const tempBase = await mkdtemp(path.join(os.tmpdir(), 'utk-pack-'));
  switch (source.type) {
    case 'local':
      return await fetchLocal(source.path, tempBase);
    case 'tarball':
      return await fetchTarball(source.path, tempBase);
    /* v8 ignore start -- network operations are tested via injected fetcher in installPack */
    case 'git':
      return await fetchGit(source, tempBase);
    case 'npm':
      return await fetchNpm(source.spec, tempBase, workspaceRoot);
    /* v8 ignore stop */
  }
}

async function fetchLocal(sourcePath: string, tempBase: string): Promise<{ dir: string; revision: string }> {
  const absolute = path.resolve(sourcePath);
  const stats = await stat(absolute);
  if (!stats.isDirectory()) {
    throw new Error(`Local pack source must be a directory: ${sourcePath}`);
  }
  const destination = path.join(tempBase, 'pack');
  await mkdir(destination, { recursive: true });
  await cp(absolute, destination, { recursive: true });
  return { dir: destination, revision: `local:${absolute}` };
}

async function fetchTarball(sourcePath: string, tempBase: string): Promise<{ dir: string; revision: string }> {
  if (/^https?:\/\//i.test(sourcePath)) {
    throw new Error(`Remote tarball URLs are not supported by the built-in tarball fetcher: ${sourcePath} — use the npm or git source type, or pass an injected fetcher`);
  }
  const absolute = path.resolve(sourcePath);
  const stats = await stat(absolute);
  if (!stats.isFile()) {
    throw new Error(`Tarball pack source must be a file: ${sourcePath}`);
  }
  const destination = path.join(tempBase, 'pack');
  await mkdir(destination, { recursive: true });
  await execFileAsync('tar', ['-xzf', absolute, '-C', destination]);
  const entries = await readdir(destination);
  if (entries.length === 1) {
    const candidate = path.join(destination, entries[0]!);
    const candidateStat = await stat(candidate);
    if (candidateStat.isDirectory()) {
      return { dir: candidate, revision: `tarball:${absolute}` };
    }
  }
  return { dir: destination, revision: `tarball:${absolute}` };
}

/* v8 ignore start -- network-bound code paths */
async function fetchGit(source: Extract<PackSource, { type: 'git' }>, tempBase: string): Promise<{ dir: string; revision: string }> {
  const destination = path.join(tempBase, 'pack');
  await mkdir(destination, { recursive: true });
  const args = ['clone', '--depth', '1'];
  if (source.ref) args.push('--branch', source.ref);
  args.push(source.url, destination);
  await execFileAsync('git', args);
  const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: destination });
  return { dir: destination, revision: stdout.trim() };
}

async function fetchNpm(spec: string, tempBase: string, workspaceRoot: string): Promise<{ dir: string; revision: string }> {
  const destination = path.join(tempBase, 'pack');
  await mkdir(destination, { recursive: true });
  const { stdout } = await execFileAsync('npm', ['pack', spec, '--json', '--silent'], { cwd: workspaceRoot });
  const parsed = JSON.parse(stdout) as Array<{ filename: string; integrity?: string }>;
  if (!Array.isArray(parsed) || parsed.length === 0 || !parsed[0]!.filename) {
    throw new Error(`npm pack did not produce a tarball for ${spec}`);
  }
  const tarballPath = path.resolve(workspaceRoot, parsed[0]!.filename);
  await execFileAsync('tar', ['-xzf', tarballPath, '-C', destination]);
  const entries = await readdir(destination);
  const root = entries.length === 1 ? path.join(destination, entries[0]!) : destination;
  return { dir: root, revision: parsed[0]!.integrity ?? `npm:${spec}` };
}
/* v8 ignore stop */
