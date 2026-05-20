import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { normalizeToolId } from '../artifact/manifest.js';
import { safeJoin } from '../security/pathSafety.js';

export type SessionSkillProfile = {
  name: string;
  description: string;
  purpose: string;
  triggers: string[];
  procedure: string[];
  references?: Record<string, string>;
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
      const triggerHits = profile.triggers.filter((trigger) => text.includes(normalizeText(trigger))).length;
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
}): Promise<SessionSkillResult> {
  const slug = normalizeToolId(params.name);
  const skillRoot = safeJoin(params.workspaceRoot, '.utk', 'session-skills', slug);
  const referencesRoot = safeJoin(skillRoot, 'references');
  const agentsRoot = safeJoin(skillRoot, 'agents');
  await mkdir(referencesRoot, { recursive: true });
  await mkdir(agentsRoot, { recursive: true });

  const skillPath = safeJoin(skillRoot, 'SKILL.md');
  await writeFile(skillPath, renderSessionSkill({ ...params, slug }), 'utf8');
  await writeFile(
    safeJoin(agentsRoot, 'openai.yaml'),
    `interface: openai\ndisplay_name: ${params.name}\nshort_description: ${params.description}\ndefault_prompt: "Use $${slug} when relevant; details in references."\n`,
    'utf8'
  );

  const referencePaths: string[] = [];
  for (const [fileName, text] of Object.entries(params.references ?? { 'procedure.md': params.procedure.join('\n') })) {
    const safeName = normalizeReferenceName(fileName);
    const referencePath = safeJoin(referencesRoot, safeName);
    await writeFile(referencePath, `${text.trim()}\n`, 'utf8');
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
  references?: Record<string, string>;
}): string {
  const referenceNames = Object.keys(params.references ?? { 'procedure.md': '' }).map(normalizeReferenceName);
  const triggerText = params.triggers.slice(0, 5).map((trigger) => `- ${trigger}`).join('\n');
  const procedureText = params.procedure.slice(0, 5).map((step, index) => `${index + 1}. ${step}`).join('\n');
  const referenceText = referenceNames.map((fileName) => `- references/${fileName}`).join('\n');
  return `---\nname: ${params.slug}\ndescription: ${params.description}\n---\n\nPurpose: ${params.purpose}\n\nUse when repeated:\n${triggerText}\n\nProcedure:\n${procedureText}\n\nRefs:\n${referenceText}\n`;
}

function normalizeReferenceName(fileName: string): string {
  const parsed = path.parse(fileName);
  const baseName = parsed.name.startsWith('.') ? '' : parsed.name;
  const base = normalizeToolId(baseName || 'procedure');
  return `${base}.md`;
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}
