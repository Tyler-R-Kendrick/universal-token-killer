import { randomUUID } from 'node:crypto';
import { rename, rm, writeFile } from 'node:fs/promises';

/**
 * Atomic single-file write via the standard write-to-temp + rename pattern.
 *
 * Node's `fs/promises.writeFile` is **not** atomic — a crash mid-write can
 * leave the target file truncated or corrupted. For files that must survive
 * SIGKILL or power loss intact (e.g. `.utk/packs.lock.toml` — UTK's source
 * of truth for installed packs), use this helper instead.
 *
 * The temp file lives next to the target so `rename` stays on the same
 * filesystem (no EXDEV). If the rename fails for any reason, the temp file
 * is best-effort cleaned up to avoid littering the workspace.
 */
export async function atomicWriteFile(filePath: string, content: string): Promise<void> {
  const tmpPath = `${filePath}.tmp.${randomUUID().slice(0, 8)}`;
  try {
    await writeFile(tmpPath, content, 'utf8');
    await rename(tmpPath, filePath);
  } catch (error) {
    try {
      await rm(tmpPath, { force: true });
    } catch {
      /* swallow — best-effort cleanup of the orphaned temp file */
    }
    throw error;
  }
}
