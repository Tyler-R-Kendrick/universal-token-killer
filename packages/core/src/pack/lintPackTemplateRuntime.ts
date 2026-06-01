import { pathToFileURL } from 'node:url';
import type { LintFinding, LintOptions } from './lintPackTypes.js';

export async function lintExecutableTemplate(
  absolute: string,
  relative: string,
  declaredGrammars: Set<string>,
  importTemplate: NonNullable<LintOptions['importTemplate']>,
  findings: LintFinding[]
): Promise<void> {
  let imported: unknown;
  try {
    imported = await importTemplate(absolute);
  } catch (error) {
    findings.push({ severity: 'error', code: 'pack/templates/import-failed', message: `template failed to import: ${(error as Error).message}`, file: relative });
    return;
  }
  const descriptor = (imported as { default?: unknown }).default;
  if (!descriptor || typeof descriptor !== 'object') {
    findings.push({ severity: 'error', code: 'pack/templates/missing-default-export', message: 'template must default-export a TemplateDescriptor', file: relative });
    return;
  }
  const candidate = descriptor as { id?: unknown; prompt?: unknown; slots?: unknown };
  if (typeof candidate.id !== 'string' || typeof candidate.prompt !== 'string' || !candidate.slots || typeof candidate.slots !== 'object') {
    findings.push({ severity: 'error', code: 'pack/templates/invalid-shape', message: 'template default export is not a TemplateDescriptor', file: relative });
    return;
  }
  const slots = candidate.slots as Record<string, unknown>;
  for (const slotName of extractSlotReferences(candidate.prompt)) {
    if (!Object.prototype.hasOwnProperty.call(slots, slotName)) {
      findings.push({ severity: 'error', code: 'pack/templates/undefined-slot', message: `prompt references undefined slot {{${slotName}}}`, file: relative });
    }
  }
  for (const [slotName, slot] of Object.entries(slots)) {
    checkSlotGrammarRef(slotName, slot, relative, declaredGrammars, findings);
  }
}

/**
 * Dynamic-import helper UTK ships for callers that want full runtime validation
 * of trusted pack templates. Not wired into lintPack by default because
 * dynamic-importing untrusted pack code during lint is an RCE surface.
 */
export function importTemplateForLint(filePath: string): Promise<unknown> {
  /* c8 ignore start -- callers must explicitly opt in via options.importTemplate; this helper is exported for that use only */
  return import(pathToFileURL(filePath).href);
  /* c8 ignore stop */
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

function extractSlotReferences(prompt: string): string[] {
  const pattern = /\{\{\s*([A-Za-z_][\w-]*)\s*\}\}/g;
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(prompt)) !== null) {
    seen.add(match[1]!);
  }
  return [...seen];
}
