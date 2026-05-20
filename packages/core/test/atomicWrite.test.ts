import { mkdtemp, readFile, stat, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { atomicWriteFile } from '../src/artifact/atomicWrite.js';

describe('atomicWriteFile', () => {
  it('writes the target file via a temp file and rename', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'utk-atomic-write-'));
    const target = path.join(dir, 'lock.toml');
    await atomicWriteFile(target, 'content');
    expect(await readFile(target, 'utf8')).toBe('content');
  });

  it('overwrites an existing file', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'utk-atomic-overwrite-'));
    const target = path.join(dir, 'lock.toml');
    await atomicWriteFile(target, 'first');
    await atomicWriteFile(target, 'second');
    expect(await readFile(target, 'utf8')).toBe('second');
  });

  it('propagates failures and cleans up the orphaned temp file', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'utk-atomic-fail-'));
    // Target a directory that doesn't exist so writeFile fails with ENOENT.
    const target = path.join(dir, 'missing-subdir', 'lock.toml');
    await expect(atomicWriteFile(target, 'content')).rejects.toThrow();

    // The temp file is in the SAME (non-existent) directory, so we instead force
    // the failure path that DOES leave a temp file: a rename target that's a directory.
    const dir2 = await mkdtemp(path.join(os.tmpdir(), 'utk-atomic-fail2-'));
    const target2 = path.join(dir2, 'lock.toml');
    await mkdir(target2, { recursive: true }); // target is now a directory, so rename will fail
    await expect(atomicWriteFile(target2, 'content')).rejects.toThrow();
    // The temp file should have been cleaned up — no leftover `lock.toml.tmp.*`.
    const remaining = await import('node:fs/promises').then((fs) => fs.readdir(dir2));
    expect(remaining.some((name) => name.startsWith('lock.toml.tmp.'))).toBe(false);
    void stat; // silence unused import
  });
});
