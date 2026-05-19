import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'smol-toml';
import { pathToFileURL } from 'node:url';
import type { FieldGrammar } from '../grammar/fieldGrammar.js';
import { safeJoin } from '../security/pathSafety.js';
import { recordFailure, type RunContext } from '../tracing/index.js';
import { normalizeManifest } from './loadPack.js';
import type {
  PackGrammarEntry,
  PackTemplateEntry,
  PackToolEntry,
  UtkPackManifest
} from './types.js';

export type LintSeverity = 'error' | 'warning' | 'info';

export type LintFinding = {
  severity: LintSeverity;
  code: string;
  message: string;
  file?: string;
  hint?: string;
};

export type LintReport = {
  ok: boolean;
  findings: LintFinding[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
};

export type LintOptions = {
  importTemplate?: (filePath: string) => Promise<unknown>;
  recommendedFields?: boolean;
  tracer?: RunContext;
};

const DEFAULT_RECOMMENDED_FIELDS = true;

export async function lintPack(packDir: string, options: LintOptions = {}): Promise<LintReport> {
  const findings: LintFinding[] = [];
  const manifest = await readManifest(packDir, findings);
  if (manifest) {
    if (options.recommendedFields ?? DEFAULT_RECOMMENDED_FIELDS) {
      lintRecommendedManifestFields(manifest, findings);
    }
    await lintToolEntries(packDir, manifest.tools ?? [], findings);
    await lintGrammarEntries(packDir, manifest.grammars ?? [], findings);
    await lintTemplateEntries(packDir, manifest, options, findings);
  }
  if (options.tracer) {
    for (const finding of findings) {
      recordFailure(options.tracer, {
        name: finding.code,
        runType: 'parser',
        error: { name: finding.severity, message: finding.message },
        extra: {
          severity: finding.severity,
          packDir,
          file: finding.file,
          hint: finding.hint
        }
      });
    }
  }
  return summarize(findings);
}

export function formatLintReport(report: LintReport, packLabel: string): string {
  const lines: string[] = [];
  if (report.findings.length === 0) {
    lines.push(`OK ${packLabel} (no findings)`);
    return `${lines.join('\n')}\n`;
  }
  for (const finding of report.findings) {
    const file = finding.file ? ` (${finding.file})` : '';
    const hint = finding.hint ? ` — ${finding.hint}` : '';
    lines.push(`[${finding.severity.toUpperCase()}] ${finding.code}: ${finding.message}${file}${hint}`);
  }
  lines.push(`${report.errorCount} error(s), ${report.warningCount} warning(s), ${report.infoCount} info`);
  return `${lines.join('\n')}\n`;
}

async function readManifest(packDir: string, findings: LintFinding[]): Promise<UtkPackManifest | undefined> {
  const manifestPath = safeJoin(packDir, 'utk.pack.toml');
  let text: string;
  try {
    text = await readFile(manifestPath, 'utf8');
  } catch {
    findings.push({ severity: 'error', code: 'pack/manifest/missing', message: 'utk.pack.toml not found at pack root', file: 'utk.pack.toml' });
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
    findings.push({ severity: 'error', code: 'pack/manifest/schema', message: (error as Error).message, file: 'utk.pack.toml' });
    return undefined;
  }
}

function lintRecommendedManifestFields(manifest: UtkPackManifest, findings: LintFinding[]): void {
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

async function lintToolEntries(packDir: string, entries: PackToolEntry[], findings: LintFinding[]): Promise<void> {
  const seenIds = new Set<string>();
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]!;
    if (seenIds.has(entry.id)) {
      findings.push({ severity: 'error', code: 'pack/tools/duplicate-id', message: `duplicate tool id: ${entry.id}`, file: 'utk.pack.toml' });
    }
    seenIds.add(entry.id);
    const relativePath = entry.file ?? `tools/${entry.id}.toml`;
    const absolute = safeJoin(packDir, relativePath);
    let text: string;
    try {
      text = await readFile(absolute, 'utf8');
    } catch {
      findings.push({ severity: 'error', code: 'pack/tools/file-missing', message: `tool definition file not found`, file: relativePath, hint: `referenced by tools[${i}]` });
      continue;
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = path.extname(absolute).toLowerCase() === '.json'
        ? (JSON.parse(text) as Record<string, unknown>)
        : (parse(text) as Record<string, unknown>);
    } catch (error) {
      findings.push({ severity: 'error', code: 'pack/tools/parse', message: `tool file is not parseable: ${(error as Error).message}`, file: relativePath });
      continue;
    }
    const toolHeader = parsed.tool && typeof parsed.tool === 'object' ? (parsed.tool as Record<string, unknown>) : undefined;
    const declaredId = toolHeader && typeof toolHeader.id === 'string' ? toolHeader.id : undefined;
    if (declaredId && declaredId !== entry.id) {
      findings.push({ severity: 'error', code: 'pack/tools/id-mismatch', message: `manifest declares tool id '${entry.id}' but file declares '${declaredId}'`, file: relativePath });
    }
    if (entry.kind === 'bash-like') {
      const command = toolHeader && typeof toolHeader.command === 'string' ? toolHeader.command : undefined;
      if (!command) {
        findings.push({ severity: 'error', code: 'pack/tools/bash-missing-command', message: `bash-like tool '${entry.id}' must declare a [tool] command`, file: relativePath });
      }
    }
    const parameters = Array.isArray(parsed.parameters) ? parsed.parameters : [];
    if (parameters.length === 0) {
      findings.push({ severity: 'warning', code: 'pack/tools/empty-parameters', message: `tool '${entry.id}' declares no parameters`, file: relativePath });
    }
  }
}

async function lintGrammarEntries(packDir: string, entries: PackGrammarEntry[], findings: LintFinding[]): Promise<void> {
  const seenPairs = new Set<string>();
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]!;
    const pairKey = `${entry.tool}/${entry.field}`;
    if (seenPairs.has(pairKey)) {
      findings.push({ severity: 'error', code: 'pack/grammars/duplicate', message: `duplicate grammar ${pairKey}`, file: 'utk.pack.toml' });
    }
    seenPairs.add(pairKey);
    const larkRelative = entry.lark ?? `grammars/${entry.tool}/${entry.field}.lark`;
    const seedRelative = entry.seed ?? `grammars/${entry.tool}/${entry.field}.grammar.json`;
    const larkExists = await pathExists(safeJoin(packDir, larkRelative));
    const seedExists = await pathExists(safeJoin(packDir, seedRelative));
    if (!larkExists && !seedExists) {
      findings.push({
        severity: 'error',
        code: 'pack/grammars/missing-files',
        message: `grammar ${pairKey} has neither a Lark file nor a FieldGrammar seed`,
        file: larkRelative,
        hint: `expected ${larkRelative} or ${seedRelative}`
      });
      continue;
    }
    if (larkExists) {
      const lark = await readFile(safeJoin(packDir, larkRelative), 'utf8');
      if (!/^\s*start\s*:/m.test(lark)) {
        findings.push({ severity: 'error', code: 'pack/grammars/missing-start-rule', message: `Lark grammar lacks a 'start:' rule`, file: larkRelative });
      }
    }
    if (seedExists) {
      try {
        const seed = JSON.parse(await readFile(safeJoin(packDir, seedRelative), 'utf8')) as FieldGrammar;
        if (typeof seed.observations !== 'number' || typeof seed.version !== 'number' || !seed.separators || !seed.lengthRange) {
          findings.push({ severity: 'error', code: 'pack/grammars/invalid-seed', message: `FieldGrammar seed has unexpected shape`, file: seedRelative });
        }
      } catch (error) {
        findings.push({ severity: 'error', code: 'pack/grammars/invalid-seed', message: `FieldGrammar seed is not valid JSON: ${(error as Error).message}`, file: seedRelative });
      }
    }
  }
}

async function lintTemplateEntries(packDir: string, manifest: UtkPackManifest, options: LintOptions, findings: LintFinding[]): Promise<void> {
  const entries = manifest.templates ?? [];
  const seenIds = new Set<string>();
  const declaredGrammars = new Set<string>((manifest.grammars ?? []).map((grammar) => `${grammar.tool}/${grammar.field}`));
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]!;
    if (seenIds.has(entry.id)) {
      findings.push({ severity: 'error', code: 'pack/templates/duplicate-id', message: `duplicate template id: ${entry.id}`, file: 'utk.pack.toml' });
    }
    seenIds.add(entry.id);
    const relative = entry.file;
    const absolute = safeJoin(packDir, relative);
    if (!(await pathExists(absolute))) {
      findings.push({ severity: 'error', code: 'pack/templates/file-missing', message: `template file not found`, file: relative });
      continue;
    }
    if (!extensionMatchesLanguage(entry)) {
      findings.push({ severity: 'error', code: 'pack/templates/language-mismatch', message: `language '${entry.language}' does not match file extension`, file: relative });
    }
    const source = await readFile(absolute, 'utf8');
    if (source.trim().length === 0) {
      findings.push({ severity: 'error', code: 'pack/templates/empty-file', message: `template file is empty`, file: relative });
      continue;
    }
    if (entry.language === 'typescript' && isExecutableJsExtension(entry.file)) {
      await lintExecutableTemplate(absolute, relative, declaredGrammars, options, findings);
    } else if (entry.language === 'typescript') {
      lintTemplateSourceHeuristically(source, relative, findings);
    } else {
      lintPythonTemplateSource(source, relative, findings);
    }
  }
}

async function lintExecutableTemplate(absolute: string, relative: string, declaredGrammars: Set<string>, options: LintOptions, findings: LintFinding[]): Promise<void> {
  const importTemplate = options.importTemplate ?? defaultImport;
  let imported: unknown;
  try {
    imported = await importTemplate(absolute);
  } catch (error) {
    findings.push({ severity: 'error', code: 'pack/templates/import-failed', message: `template failed to import: ${(error as Error).message}`, file: relative });
    return;
  }
  const moduleObject = imported as { default?: unknown };
  const descriptor = moduleObject.default;
  if (!descriptor || typeof descriptor !== 'object') {
    findings.push({ severity: 'error', code: 'pack/templates/missing-default-export', message: `template must default-export a TemplateDescriptor`, file: relative });
    return;
  }
  const candidate = descriptor as { id?: unknown; prompt?: unknown; slots?: unknown };
  if (typeof candidate.id !== 'string' || typeof candidate.prompt !== 'string' || !candidate.slots || typeof candidate.slots !== 'object') {
    findings.push({ severity: 'error', code: 'pack/templates/invalid-shape', message: `template default export is not a TemplateDescriptor`, file: relative });
    return;
  }
  const slots = candidate.slots as Record<string, unknown>;
  const referenced = extractSlotReferences(candidate.prompt);
  for (const slotName of referenced) {
    if (!Object.prototype.hasOwnProperty.call(slots, slotName)) {
      findings.push({ severity: 'error', code: 'pack/templates/undefined-slot', message: `prompt references undefined slot {{${slotName}}}`, file: relative });
    }
  }
  for (const [slotName, slot] of Object.entries(slots)) {
    checkSlotGrammarRef(slotName, slot, relative, declaredGrammars, findings);
  }
}

function checkSlotGrammarRef(
  slotName: string,
  slot: unknown,
  relative: string,
  declaredGrammars: Set<string>,
  findings: LintFinding[]
): void {
  if (!slot || typeof slot !== 'object') return;
  const ref = (slot as { grammar?: unknown }).grammar;
  if (!ref || typeof ref !== 'object') return;
  const grammarRef = ref as { kind?: string; tool?: string; field?: string };
  if (grammarRef.kind !== 'pack') return;
  if (!grammarRef.tool || !grammarRef.field) return;
  const key = `${grammarRef.tool}/${grammarRef.field}`;
  if (declaredGrammars.has(key)) return;
  findings.push({
    severity: 'warning',
    code: 'pack/templates/external-grammar',
    message: `template slot '${slotName}' references grammar ${key} not declared in this pack`,
    file: relative,
    hint: 'declare it under [[grammars]] or document the external dependency'
  });
}

function lintTemplateSourceHeuristically(source: string, relative: string, findings: LintFinding[]): void {
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

function lintPythonTemplateSource(source: string, relative: string, findings: LintFinding[]): void {
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

function isExecutableJsExtension(file: string): boolean {
  const ext = path.extname(file).toLowerCase();
  return ext === '.js' || ext === '.mjs' || ext === '.cjs';
}

function defaultImport(filePath: string): Promise<unknown> {
  return import(pathToFileURL(filePath).href);
}

function extractSlotReferences(prompt: string): string[] {
  const pattern = /\{\{\s*([A-Za-z_][\w-]*)\s*\}\}/g;
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(prompt)) !== null) {
    seen.add(match[1]!);
  }
  return [...seen];
}

function extensionMatchesLanguage(entry: PackTemplateEntry): boolean {
  const ext = path.extname(entry.file).toLowerCase();
  if (entry.language === 'typescript') return ext === '.ts' || ext === '.js' || ext === '.mts' || ext === '.mjs';
  return ext === '.py';
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

function summarize(findings: LintFinding[]): LintReport {
  let errors = 0;
  let warnings = 0;
  let infos = 0;
  for (const finding of findings) {
    if (finding.severity === 'error') errors += 1;
    else if (finding.severity === 'warning') warnings += 1;
    else infos += 1;
  }
  return {
    ok: errors === 0,
    findings,
    errorCount: errors,
    warningCount: warnings,
    infoCount: infos
  };
}
