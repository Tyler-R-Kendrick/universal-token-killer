import { readFile } from 'node:fs/promises';
import { safeJoin } from '../security/pathSafety.js';
import type { PackTemplateEntry, UtkPackManifest } from './types.js';
import type { LintFinding, LintOptions } from './lintPackTypes.js';
import { pathExists } from './lintPackFiles.js';
import {
  extensionMatchesLanguage,
  isExecutableJsExtension,
  lintPythonTemplateSource,
  lintTemplateSourceHeuristically
} from './lintPackTemplateHeuristics.js';
import { importTemplateForLint, lintExecutableTemplate } from './lintPackTemplateRuntime.js';

export { importTemplateForLint };

export async function lintTemplateEntries(packDir: string, manifest: UtkPackManifest, options: LintOptions, findings: LintFinding[]): Promise<void> {
  const entries = manifest.templates ?? [];
  const seenIds = new Set<string>();
  const declaredGrammars = new Set<string>((manifest.grammars ?? []).map((grammar) => `${grammar.tool}/${grammar.field}`));
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]!;
    if (seenIds.has(entry.id)) {
      findings.push({ severity: 'error', code: 'pack/templates/duplicate-id', message: `duplicate template id: ${entry.id}`, file: 'utk.pack.toml' });
    }
    seenIds.add(entry.id);
    await lintTemplateEntry(packDir, entry, declaredGrammars, options, findings);
  }
}

async function lintTemplateEntry(
  packDir: string,
  entry: PackTemplateEntry,
  declaredGrammars: Set<string>,
  options: LintOptions,
  findings: LintFinding[]
): Promise<void> {
  const relative = entry.file;
  const absolute = safeJoin(packDir, relative);
  if (!(await pathExists(absolute))) {
    findings.push({ severity: 'error', code: 'pack/templates/file-missing', message: 'template file not found', file: relative });
    return;
  }
  if (!extensionMatchesLanguage(entry)) {
    findings.push({ severity: 'error', code: 'pack/templates/language-mismatch', message: `language '${entry.language}' does not match file extension`, file: relative });
  }
  const source = await readFile(absolute, 'utf8');
  if (source.trim().length === 0) {
    findings.push({ severity: 'error', code: 'pack/templates/empty-file', message: 'template file is empty', file: relative });
    return;
  }
  if (entry.language === 'typescript' && isExecutableJsExtension(entry.file)) {
    await lintExecutableOrSourceTemplate(absolute, relative, source, declaredGrammars, options, findings);
  } else if (entry.language === 'typescript') {
    lintTemplateSourceHeuristically(source, relative, findings);
  } else {
    lintPythonTemplateSource(source, relative, findings);
  }
}

async function lintExecutableOrSourceTemplate(
  absolute: string,
  relative: string,
  source: string,
  declaredGrammars: Set<string>,
  options: LintOptions,
  findings: LintFinding[]
): Promise<void> {
  if (options.importTemplate) {
    await lintExecutableTemplate(absolute, relative, declaredGrammars, options.importTemplate, findings);
    return;
  }
  lintTemplateSourceHeuristically(source, relative, findings);
  findings.push({
    severity: 'info',
    code: 'pack/templates/runtime-validation-skipped',
    message: 'skipped runtime template import for safety; pass options.importTemplate to opt in',
    file: relative
  });
}
