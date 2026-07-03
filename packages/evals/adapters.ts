import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseBenchmark, type BenchmarkCase } from './data.js';

/**
 * Real-dataset adapter seam.
 *
 * The committed datasets under `data/*.jsonl` are synthetic analogs, so the
 * leaderboard is reproducible offline with no network or license entanglement.
 * To measure a technique against a REAL external dataset — LongBench v2, RULER,
 * BFCL, τ-bench, SWE-bench Verified — convert its examples to the
 * {@link BenchmarkCase} shape (one `<benchmark>.jsonl` per benchmark) and point
 * `UTK_REAL_DATA_DIR` at the directory holding them.
 *
 * Nothing here fetches or vendors any dataset: you supply a local export under
 * that dataset's own license. When the seam is unconfigured the harness silently
 * falls back to the committed synthetic analog, so `npm run evals` never depends
 * on external data being present.
 *
 * Conversion contract (raw external example → BenchmarkCase):
 * - `rawOutput`   ← the full retrieved context / tool output / document.
 * - `requiredFacts` ← literal substrings of `rawOutput` the answer depends on.
 * - `irrelevantFacts` ← literal substrings that are noise (used for the
 *   relevance/exclusion signal); may be empty.
 * - `unsafeTools` (tool-selection only) ← mutating/destructive tool names present
 *   in `rawOutput`, so a dropped safe tool that leaves one visible is scored as an
 *   unsafe-tool error.
 * Every fact MUST be a verbatim substring of `rawOutput` (the loader does not
 * enforce this — validate on conversion, as the synthetic generator does).
 */
export const REAL_DATA_DIR = process.env.UTK_REAL_DATA_DIR ?? '';

/** True when a real-dataset directory is configured (adapters run; otherwise skipped). */
export function realDataConfigured(): boolean {
  return REAL_DATA_DIR.trim().length > 0;
}

/**
 * Load a real dataset export `<benchmark>.jsonl` (already in the BenchmarkCase
 * shape) from `UTK_REAL_DATA_DIR`. Returns `null` when the seam is not configured
 * or the file is absent, so the caller falls back to the committed synthetic analog.
 */
export async function loadRealDataset(benchmark: string, dir: string = REAL_DATA_DIR): Promise<BenchmarkCase[] | null> {
  if (dir.trim().length === 0) return null;
  try {
    const jsonl = await readFile(path.join(dir, `${benchmark}.jsonl`), 'utf8');
    return parseBenchmark(jsonl);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}
