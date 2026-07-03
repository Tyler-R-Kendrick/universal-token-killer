import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalJson, contentHash } from '@utk/foundation';
import { safeJoin } from '@utk/foundation';
import { discoverSessionAgentCandidates } from './sessionAgentDiscovery.js';
import { buildSketchOfThoughtLexiconGrammar } from './sessionAgentGrammar.js';
import {
  normalizeAgentSlug,
  normalizeDescription,
  renderSessionAgent,
  uniqueLines
} from './sessionAgentRendering.js';
import type {
  SessionAgentCandidate,
  SessionAgentHandoff,
  SessionAgentMcpServer,
  SessionAgentProfile,
  SessionAgentResult
} from './sessionAgentTypes.js';

export type {
  SessionAgentCandidate,
  SessionAgentHandoff,
  SessionAgentMcpServer,
  SessionAgentProfile,
  SessionAgentResult
} from './sessionAgentTypes.js';
export { discoverSessionAgentCandidates } from './sessionAgentDiscovery.js';

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
  target?: 'vscode' | 'github-copilot';
  tools?: string[] | string;
  model?: string;
  disableModelInvocation?: boolean;
  userInvocable?: boolean;
  infer?: boolean;
  argumentHint?: string;
  agents?: string[];
  handoffs?: SessionAgentHandoff[];
  mcpServers?: Record<string, SessionAgentMcpServer>;
  metadata?: Record<string, string>;
  hooks?: Record<string, Array<{ command: string; timeout?: number }>>;
  bodyInstructions?: string;
  mixedConcerns?: string[];
}): Promise<SessionAgentResult> {
  const slug = normalizeAgentSlug(params.name);
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
  await removeStaleAgentFiles({ grammarsRoot, toolsRoot, referencesRoot, slug });

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
      description: normalizeDescription(params.description),
      expectedReuse: params.expectedReuse,
      grammarHash,
      grammarPath: path.relative(params.workspaceRoot, grammarPath),
      toolRegistrationPath: path.relative(params.workspaceRoot, toolRegistrationPath),
      target: params.target,
      tools: params.tools,
      model: params.model,
      disableModelInvocation: params.disableModelInvocation ?? (params.infer === false ? true : undefined),
      userInvocable: params.userInvocable,
      argumentHint: params.argumentHint,
      agents: params.agents,
      handoffs: params.handoffs,
      mcpServers: params.mcpServers,
      metadata: params.metadata,
      hooks: params.hooks
    }),
    'utf8'
  );
  await writeFile(
    promptReferencePath,
    [
      `# ${slug} prompt reference`,
      '',
      'Preserve UTK architecture: hook-first mediation, project-local artifacts, schema routing, official TOON, compressed JSON, and guidance-backed constraints.',
      `Full description: ${params.description}`,
      `Expected reuse signal: ${params.expectedReuse}`,
      'Keep visible answers concise and actionable; do not inline lexicon grammar.',
      ...((params.mixedConcerns ?? []).length > 0 ? ['', 'Mixed concern split candidates:', ...uniqueLines(params.mixedConcerns ?? []).map((item) => `- ${item}`)] : []),
      ...(params.bodyInstructions ? ['', params.bodyInstructions.trim()] : [])
    ].join('\n'),
    'utf8'
  );

  return { name: slug, agentPath, grammarPath, toolRegistrationPath, promptReferencePath, grammarHash };
}

async function removeStaleAgentFiles(params: { grammarsRoot: string; toolsRoot: string; referencesRoot: string; slug: string }): Promise<void> {
  await removeMatching(params.grammarsRoot, new RegExp(`^${escapeRegExp(params.slug)}\\..+\\.guidance\\.json$`));
  await removeMatching(params.toolsRoot, new RegExp(`^${escapeRegExp(params.slug)}\\.reason-with-lexicon\\.json$`));
  await removeMatching(params.referencesRoot, new RegExp(`^${escapeRegExp(params.slug)}\\.prompt\\.md$`));
}

async function removeMatching(root: string, pattern: RegExp): Promise<void> {
  for (const name of await readdir(root)) {
    if (pattern.test(name)) await rm(path.join(root, name), { force: true });
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
