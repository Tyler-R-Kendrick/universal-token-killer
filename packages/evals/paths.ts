import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Absolute path to the `@utk/evals` package root, resolved by climbing to the
 * `evals` directory. Works whether a module runs from source (`packages/evals/*`)
 * or from the compiled tree (`packages/evals/dist/*`), so data reads and artifact
 * writes always target the committed source tree.
 */
export const PACKAGE_ROOT = resolvePackageRoot(import.meta.url);
export const REPO_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');
export const DATA_DIR = path.join(PACKAGE_ROOT, 'data');
export const SUITES_DIR = path.join(PACKAGE_ROOT, 'suites');
export const RESULTS_DIR = path.join(PACKAGE_ROOT, 'results');

function resolvePackageRoot(moduleUrl: string): string {
  let dir = path.dirname(fileURLToPath(moduleUrl));
  while (path.basename(dir) !== 'evals' && dir !== path.dirname(dir)) {
    dir = path.dirname(dir);
  }
  if (path.basename(dir) !== 'evals') {
    throw new Error(`Could not locate the @utk/evals package root from ${moduleUrl}`);
  }
  return dir;
}
