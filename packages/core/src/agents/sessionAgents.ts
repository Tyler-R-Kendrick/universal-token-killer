import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gen, grm, select } from 'guidance-ts';
import { canonicalJson, contentHash } from '../artifact/canonical.js';
import { normalizeToolId } from '../artifact/manifest.js';
import { safeJoin } from '../security/pathSafety.js';

export type SessionAgentProfile = {
  name: string;
  description: string;
  domain: string;
  lexicon: string[];
  triggers: string[];
};

export type SessionAgentCandidate = SessionAgentProfile & {
  expectedReuse: string;
  triggerHits: number;
};

export type SessionAgentResult = {
  name: string;
  agentPath: string;
  grammarPath: string;
  toolRegistrationPath: string;
  promptReferencePath?: string;
  grammarHash: string;
};

export function discoverSessionAgentCandidates(params: {
  messages: string[];
  profiles: SessionAgentProfile[];
  minTriggerHits?: number;
}): SessionAgentCandidate[] {
  const text = normalizeText(params.messages.join('\n'));
  const minTriggerHits = params.minTriggerHits ?? 2;
  return params.profiles
    .map((profile) => {
      const triggerHits = profile.triggers.filter((trigger) => text.includes(normalizeText(trigger))).length;
      return {
        ...profile,
        triggerHits,
        expectedReuse: `${triggerHits} trigger hits across recent chat; generate a reusable session subagent.`
      };
    })
    .filter((candidate) => candidate.triggerHits >= minTriggerHits)
    .sort((left, right) => right.triggerHits - left.triggerHits || left.name.localeCompare(right.name));
}

export async function upsertSessionAgentsFromChat(params: {
  workspaceRoot: string;
  messages: string[];
  profiles: SessionAgentProfile[];
  minTriggerHits?: number;
}): Promise<SessionAgentResult[]> {
  const candidates = discoverSessionAgentCandidates(params);
  return Promise.all(candidates.map((candidate) => upsertSessionAgent({ workspaceRoot: params.workspaceRoot, ...candidate })));
}

export async function upsertSessionAgent(params: {
  workspaceRoot: string;
  name: string;
  description: string;
  domain: string;
  expectedReuse: string;
  lexicon: string[];
  triggers: string[];
}): Promise<SessionAgentResult> {
  const slug = normalizeToolId(params.name);
  const sessionAgentsRoot = safeJoin(params.workspaceRoot, '.utk', 'session-agents');
  const grammarsRoot = safeJoin(sessionAgentsRoot, 'grammars');
  const toolsRoot = safeJoin(sessionAgentsRoot, 'tools');
  const referencesRoot = safeJoin(sessionAgentsRoot, 'references');
  await mkdir(grammarsRoot, { recursive: true });
  await mkdir(toolsRoot, { recursive: true });
  await mkdir(referencesRoot, { recursive: true });

  const grammar = buildSketchOfThoughtLexiconGrammar(params.domain, params.lexicon);
  const serializedGrammar = grammar.serialize();
  const grammarHash = contentHash(serializedGrammar, 8);
  const grammarPath = safeJoin(grammarsRoot, `${slug}.${grammarHash}.guidance.json`);
  const toolRegistrationPath = safeJoin(toolsRoot, `${slug}.reason-with-lexicon.json`);
  const agentPath = safeJoin(sessionAgentsRoot, `${slug}.agent.md`);
  const promptReferencePath = safeJoin(referencesRoot, `${slug}.prompt.md`);

  await writeFile(
    grammarPath,
    canonicalJson({
      decoder: 'guidance-ts',
      kind: 'sketch-of-thought-lexicon',
      domain: params.domain,
      grammarHash,
      grammar: serializedGrammar
    }),
    'utf8'
  );
  await writeFile(
    toolRegistrationPath,
    canonicalJson({
      tool: 'reason-with-lexicon',
      agent: slug,
      grammarHash,
      grammarPath: path.relative(params.workspaceRoot, grammarPath),
      outputContract: 'sketch-of-thought'
    }),
    'utf8'
  );
  await writeFile(
    agentPath,
    renderSessionAgent({
      slug,
      description: params.description,
      expectedReuse: params.expectedReuse,
      grammarHash,
      grammarPath: path.relative(params.workspaceRoot, grammarPath),
      toolRegistrationPath: path.relative(params.workspaceRoot, toolRegistrationPath)
    }),
    'utf8'
  );
  await writeFile(
    promptReferencePath,
    [
      `# ${slug} prompt reference`,
      '',
      'Preserve UTK architecture: hook-first mediation, project-local artifacts, schema routing, official TOON, compressed JSON, and guidance-backed constraints.',
      `Expected reuse signal: ${params.expectedReuse}`,
      'Keep visible answers concise and actionable; do not inline lexicon grammar.'
    ].join('\n'),
    'utf8'
  );

  return { name: slug, agentPath, grammarPath, toolRegistrationPath, promptReferencePath, grammarHash };
}

function buildSketchOfThoughtLexiconGrammar(domain: string, lexicon: string[]) {
  const lexiconChoices = nonEmptyChoices(lexicon.map((item) => item.trim()).filter(Boolean));
  return grm`sketch{domain:"${select(domain)}",move:"${select('observe', 'classify', 'compare', 'decide', 'verify')}",term:"${select(...lexiconChoices)}",claim:"${gen('claim', /[A-Za-z0-9 ._:/-]{1,160}/)}"}`;
}

function renderSessionAgent(params: {
  slug: string;
  description: string;
  expectedReuse: string;
  grammarHash: string;
  grammarPath: string;
  toolRegistrationPath: string;
}): string {
  return `---\nname: ${params.slug}\ndescription: ${params.description}\ntools: ["reason-with-lexicon"]\n---\n\nCall \`reason-with-lexicon\` first; output sketch-of-thought.\nGrammar hash: \`${params.grammarHash}\`.\nGrammar: \`${params.grammarPath}\`.\nTool registration: \`${params.toolRegistrationPath}\`.\nOutput contract: sketch-of-thought.\nFull prompt guidance: \`.utk/session-agents/references/${params.slug}.prompt.md\`.\n`;
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function nonEmptyChoices(values: string[]): [string, ...string[]] {
  const unique = [...new Set(values)];
  return unique.length === 0 ? ['general'] : (unique as [string, ...string[]]);
}
