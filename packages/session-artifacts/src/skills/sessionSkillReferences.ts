import path from 'node:path';
import { normalizeSkillSlug, uniqueNormalizedLines } from './sessionSkillText.js';

const WINDOWS_RESERVED_BASENAMES = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  'com1',
  'com2',
  'com3',
  'com4',
  'com5',
  'com6',
  'com7',
  'com8',
  'com9',
  'lpt1',
  'lpt2',
  'lpt3',
  'lpt4',
  'lpt5',
  'lpt6',
  'lpt7',
  'lpt8',
  'lpt9'
]);

export type SessionSkillReferenceEntry = {
  fileName: string;
  text: string;
};

export function buildReferenceEntries(
  procedure: string[],
  references?: Record<string, string>,
  commonMistakes?: string[],
  evalScenarios?: string[]
): SessionSkillReferenceEntry[] {
  const entries: Array<{ requestedName: string; text: string }> = [
    {
      requestedName: 'procedure.md',
      text: procedure.length > 0 ? procedure.join('\n') : 'No procedure captured.'
    }
  ];

  if ((commonMistakes ?? []).length > 0) {
    entries.push({ requestedName: 'common-mistakes.md', text: uniqueNormalizedLines(commonMistakes ?? []).map((item) => `- ${item}`).join('\n') });
  }
  if ((evalScenarios ?? []).length > 0) {
    entries.push({ requestedName: 'eval-scenarios.md', text: uniqueNormalizedLines(evalScenarios ?? []).map((item) => `- ${item}`).join('\n') });
  }
  for (const [requestedName, text] of Object.entries(references ?? {})) {
    entries.push({ requestedName, text });
  }

  const used = new Map<string, number>();
  return entries
    .map((entry) => {
      const normalized = normalizeReferenceName(entry.requestedName);
      const parsed = path.parse(normalized);
      const seen = used.get(normalized) ?? 0;
      used.set(normalized, seen + 1);
      const fileName = seen === 0 ? normalized : `${parsed.name}-${seen + 1}${parsed.ext}`;
      return { fileName, text: entry.text.trim() ? entry.text : 'No reference content captured.' };
    })
    .sort((left, right) => left.fileName.localeCompare(right.fileName));
}

function normalizeReferenceName(fileName: string): string {
  // Strip directory components using both POSIX and Windows separators so untrusted
  // names like `..\\..\\escape.md` are reduced to their basename regardless of host OS.
  const lastSegment = fileName.split(/[\\/]/).pop() ?? '';
  const parsed = path.parse(lastSegment);
  const baseName = parsed.name.startsWith('.') ? '' : parsed.name;
  let base = normalizeSkillSlug(baseName || 'procedure');
  if (WINDOWS_RESERVED_BASENAMES.has(base)) base = `${base}-ref`;
  return `${base}.md`;
}
