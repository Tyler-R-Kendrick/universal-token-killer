import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { normalizeToolId } from '../artifact/manifest.js';
import { safeJoin } from '../security/pathSafety.js';

const MAX_DESCRIPTION_CHARS = 160;
const WINDOWS_RESERVED_BASENAMES = new Set(['con', 'prn', 'aux', 'nul', 'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9', 'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9']);

export type SessionSkillProfile = {
  name: string;
  description: string;
  purpose: string;
  triggers: string[];
  procedure: string[];
  references?: Record<string, string>;
  requiredSkills?: string[];
  whenNotToUse?: string[];
  commonMistakes?: string[];
  evalScenarios?: string[];
};

export type SessionSkillCandidate = SessionSkillProfile & {
  expectedReuse: string;
  triggerHits: number;
};

export type SessionSkillResult = {
  name: string;
  skillRoot: string;
  skillPath: string;
  referencePaths: string[];
};

export function discoverSessionSkillCandidates(params: {
  messages: string[];
  profiles: SessionSkillProfile[];
  minTriggerHits?: number;
}): SessionSkillCandidate[] {
  const text = normalizeText(params.messages.join('\n'));
  const minTriggerHits = params.minTriggerHits ?? 2;
  return params.profiles
    .map((profile) => {
      const triggerHits = countProfileTriggerHits(text, profile.triggers);
      return {
        ...profile,
        triggerHits,
        expectedReuse: `${triggerHits} trigger hits across recent chat; generate a reusable session skill to reduce repeated prompt tokens.`
      };
    })
    .filter((candidate) => candidate.triggerHits >= minTriggerHits)
    .sort((left, right) => right.triggerHits - left.triggerHits || left.name.localeCompare(right.name));
}

export async function upsertSessionSkillsFromChat(params: {
  workspaceRoot: string;
  messages: string[];
  profiles: SessionSkillProfile[];
  minTriggerHits?: number;
}): Promise<SessionSkillResult[]> {
  const candidates = discoverSessionSkillCandidates(params);
  return Promise.all(candidates.map((candidate) => upsertSessionSkill({ workspaceRoot: params.workspaceRoot, ...candidate })));
}

export async function upsertSessionSkill(params: {
  workspaceRoot: string;
  name: string;
  description: string;
  purpose: string;
  triggers: string[];
  procedure: string[];
  references?: Record<string, string>;
  requiredSkills?: string[];
  whenNotToUse?: string[];
  commonMistakes?: string[];
  evalScenarios?: string[];
}): Promise<SessionSkillResult> {
  const slug = normalizeSkillSlug(params.name);
  const skillRoot = safeJoin(params.workspaceRoot, '.utk', 'session-skills', slug);
  const referencesRoot = safeJoin(skillRoot, 'references');
  const agentsRoot = safeJoin(skillRoot, 'agents');
  await rm(referencesRoot, { recursive: true, force: true });
  await mkdir(referencesRoot, { recursive: true });
  await mkdir(agentsRoot, { recursive: true });

  const description = normalizeDescription(params.description);
  const referenceEntries = buildReferenceEntries(params.procedure, params.references, params.commonMistakes, params.evalScenarios);
  const skillPath = safeJoin(skillRoot, 'SKILL.md');
  await writeFile(skillPath, renderSessionSkill({ ...params, description, slug, referenceNames: referenceEntries.map((entry) => entry.fileName) }), 'utf8');
  await writeFile(
    safeJoin(agentsRoot, 'openai.yaml'),
    `interface: openai\ndisplay_name: ${yamlScalar(sanitizeMetadataScalar(params.name))}\nshort_description: ${yamlScalar(description)}\ndefault_prompt: "Use $${slug} when relevant; details in references."\n`,
    'utf8'
  );

  const referencePaths: string[] = [];
  for (const reference of referenceEntries) {
    const referencePath = safeJoin(referencesRoot, reference.fileName);
    await writeFile(referencePath, `${reference.text.trim()}\n`, 'utf8');
    referencePaths.push(referencePath);
  }

  return { name: slug, skillRoot, skillPath, referencePaths: referencePaths.sort() };
}

function renderSessionSkill(params: {
  slug: string;
  description: string;
  purpose: string;
  triggers: string[];
  procedure: string[];
  referenceNames: string[];
  requiredSkills?: string[];
  whenNotToUse?: string[];
}): string {
  const triggers = uniqueNormalizedLines(params.triggers).length > 0 ? uniqueNormalizedLines(params.triggers).slice(0, 5) : [fallbackTrigger(params.description)];
  const procedure = shouldUseProcedureReferencePreview(params.procedure)
    ? ['See references/procedure.md.']
    : params.procedure.length > 0
      ? params.procedure.slice(0, 5)
      : ['See references/procedure.md.'];
  const requiredSkills = normalizeRequiredSkills(params.requiredSkills ?? []);
  const boundaries = uniqueNormalizedLines(params.whenNotToUse ?? []);
  const triggerText = triggers.map((trigger) => `- ${sanitizeBodyLine(trigger)}`).join('\n');
  const procedureText = procedure.map((step, index) => `${index + 1}. ${sanitizeProcedurePreview(step)}`).join('\n');
  const referenceText = params.referenceNames.map((fileName) => `- references/${fileName}`).join('\n');
  const requiredText = requiredSkills.length > 0 ? `\n\nRequired skills:\n${requiredSkills.map((skill) => `- ${skill}`).join('\n')}` : '';
  const boundaryText = boundaries.length > 0 ? `\n\nDo not use when:\n${boundaries.map((boundary) => `- ${boundary}`).join('\n')}` : '';
  return `---\nname: ${params.slug}\ndescription: ${yamlScalar(params.description)}\n---\n\n# ${params.slug}\n\nPurpose: ${sanitizeBodyLine(params.purpose) || 'Reduce repeated instructions across future turns.'}\n\nUse when repeated:\n${triggerText}\n\nProcedure:\n${procedureText}${requiredText}${boundaryText}\n\nRefs:\n${referenceText}\n`;
}

function normalizeReferenceName(fileName: string): string {
  const parsed = path.parse(fileName);
  const baseName = parsed.name.startsWith('.') ? '' : parsed.name;
  let base = normalizeSkillSlug(baseName || 'procedure');
  if (WINDOWS_RESERVED_BASENAMES.has(base)) base = `${base}-ref`;
  return `${base}.md`;
}

function buildReferenceEntries(procedure: string[], references?: Record<string, string>, commonMistakes?: string[], evalScenarios?: string[]): Array<{ fileName: string; text: string }> {
  const customEntries = Object.entries(references ?? {});
  const entries: Array<{ requestedName: string; text: string }> = [];
  entries.push({
    requestedName: 'procedure.md',
    text: procedure.length > 0 ? procedure.join('\n') : 'No procedure captured.'
  });
  if ((commonMistakes ?? []).length > 0) {
    entries.push({ requestedName: 'common-mistakes.md', text: uniqueNormalizedLines(commonMistakes ?? []).map((item) => `- ${item}`).join('\n') });
  }
  if ((evalScenarios ?? []).length > 0) {
    entries.push({ requestedName: 'eval-scenarios.md', text: uniqueNormalizedLines(evalScenarios ?? []).map((item) => `- ${item}`).join('\n') });
  }
  for (const [requestedName, text] of customEntries) {
    entries.push({ requestedName, text });
  }

  const used = new Map<string, number>();
  return entries.map((entry) => {
    const normalized = normalizeReferenceName(entry.requestedName);
    const parsed = path.parse(normalized);
    const seen = used.get(normalized) ?? 0;
    used.set(normalized, seen + 1);
    const fileName = seen === 0 ? normalized : `${parsed.name}-${seen + 1}${parsed.ext}`;
    return { fileName, text: entry.text.trim() ? entry.text : 'No reference content captured.' };
  }).sort((left, right) => left.fileName.localeCompare(right.fileName));
}

function sanitizeMetadataScalar(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r?\n/g, ' ')
    .replace(/\s*---\s*/g, ' ')
    .replace(/\s+(?:name|tags|tools|version):\s*(?:\[[^\]]*\]|"[^"]*"|'[^']*'|[^\s.]+)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDescription(value: string): string {
  const sanitized = sanitizeMetadataScalar(value);
  if (!sanitized) return 'Use when this workflow repeats.';
  const prefixed = /^Use when\b/i.test(sanitized) ? sanitized : `Use when ${sanitized}`;
  const punctuated = /[.!?]$/.test(prefixed) ? prefixed : `${prefixed}.`;
  if (punctuated.length <= MAX_DESCRIPTION_CHARS) return punctuated;
  const clipped = punctuated.slice(0, MAX_DESCRIPTION_CHARS - 1).trimEnd();
  return `${clipped.replace(/[.,;:!?-]+$/, '')}.`;
}

function sanitizeBodyLine(value: string): string {
  return value
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, '')
    .trim();
}

function sanitizeProcedurePreview(value: string): string {
  return sanitizeBodyLine(value);
}

function yamlScalar(value: string): string {
  if (/^[A-Za-z0-9][A-Za-z0-9 _.,;:()/$@+-]*$/.test(value) && !/\s#/.test(value)) return value;
  return JSON.stringify(value);
}

function fallbackTrigger(description: string): string {
  const cleaned = sanitizeMetadataScalar(description)
    .replace(/^Use when\s+/i, '')
    .replace(/\brepeats?\.?$/i, '')
    .replace(/\brepeated\.?$/i, '')
    .replace(/^[\s.]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || 'this workflow repeats';
}

function normalizeSkillSlug(value: string): string {
  if (!/[A-Za-z0-9]/.test(value)) return 'skill';
  return normalizeToolId(value).replace(/_/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'skill';
}

function uniqueNormalizedLines(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    const normalized = sanitizeBodyLine(value);
    const key = normalized.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(normalized);
  }
  return unique;
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function countProfileTriggerHits(text: string, triggers: string[]): number {
  const needles = uniqueNormalizedLines(triggers)
    .map(normalizeText)
    .filter(Boolean)
    .sort((left, right) => right.length - left.length || left.localeCompare(right));
  const claimed: Array<{ start: number; end: number }> = [];
  let count = 0;
  for (const needle of needles) {
    let index = 0;
    while (index < text.length) {
      const found = text.indexOf(needle, index);
      if (found === -1) break;
      const end = found + needle.length;
      if (!isWordChar(text[found - 1]) && !isWordChar(text[end]) && !claimed.some((range) => found < range.end && end > range.start)) {
        claimed.push({ start: found, end });
        count += 1;
      }
      index = end;
    }
  }
  return count;
}

function isWordChar(value: string | undefined): boolean {
  return Boolean(value && /[a-z0-9]/i.test(value));
}

function normalizeRequiredSkills(values: string[]): string[] {
  return uniqueNormalizedLines(values)
    .map((value) => value.replace(/^\$/, '').trim())
    .filter(Boolean);
}

function shouldUseProcedureReferencePreview(procedure: string[]): boolean {
  return procedure.some((step) => /\r?\n|```|^\s*\||^\s*!!!/.test(step));
}
