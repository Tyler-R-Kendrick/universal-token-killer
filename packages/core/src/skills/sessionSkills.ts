import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { safeJoin } from '@utk/foundation';
import { discoverSessionSkillCandidates } from './sessionSkillDiscovery.js';
import { buildReferenceEntries } from './sessionSkillReferences.js';
import { renderSessionSkill } from './sessionSkillRendering.js';
import { normalizeDescription, normalizeSkillSlug, sanitizeMetadataScalar, yamlScalar } from './sessionSkillText.js';
import type { SessionSkillProfile, SessionSkillResult } from './sessionSkillTypes.js';

export { discoverSessionSkillCandidates } from './sessionSkillDiscovery.js';
export type { SessionSkillCandidate, SessionSkillProfile, SessionSkillResult } from './sessionSkillTypes.js';

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
