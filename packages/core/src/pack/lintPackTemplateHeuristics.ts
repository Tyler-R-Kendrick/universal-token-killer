import path from 'node:path';
import type { LintFinding } from './lintPackTypes.js';
import type { PackTemplateEntry } from './types.js';

export function lintTemplateSourceHeuristically(source: string, relative: string, findings: LintFinding[]): void {
  if (!/export\s+default/.test(source)) {
    findings.push({
      severity: 'error',
      code: 'pack/templates/missing-default-export',
      message: 'TypeScript template must contain an `export default` declaration',
      file: relative
    });
    return;
  }
  if (!/defineTemplate\s*\(/.test(source) && !/(id\s*:\s*['"])/.test(source)) {
    findings.push({
      severity: 'warning',
      code: 'pack/templates/heuristic-shape',
      message: 'TypeScript template does not appear to call defineTemplate or declare id/prompt/slots',
      file: relative,
      hint: 'lint cannot fully validate .ts files; consider shipping pre-compiled .js sidecars for deeper checks'
    });
  }
}

export function lintPythonTemplateSource(source: string, relative: string, findings: LintFinding[]): void {
  if (!/def\s+\w+\s*\(|TEMPLATE\s*=/.test(source)) {
    findings.push({
      severity: 'warning',
      code: 'pack/templates/heuristic-python',
      message: 'Python template does not declare a function or TEMPLATE constant',
      file: relative,
      hint: 'lint cannot execute .py files; runtime validation happens in the Python consumer'
    });
  }
}

export function isExecutableJsExtension(file: string): boolean {
  const ext = path.extname(file).toLowerCase();
  return ext === '.js' || ext === '.mjs' || ext === '.cjs';
}

export function extensionMatchesLanguage(entry: PackTemplateEntry): boolean {
  const ext = path.extname(entry.file).toLowerCase();
  if (entry.language === 'typescript') return ext === '.ts' || ext === '.js' || ext === '.mts' || ext === '.mjs' || ext === '.cjs';
  return ext === '.py';
}
