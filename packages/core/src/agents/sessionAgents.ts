import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
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
};

export type SessionAgentHandoff = {
  label: string;
  agent: string;
  prompt: string;
  send?: boolean;
  model?: string;
};

export type SessionAgentMcpServer = {
  type?: string;
  command?: string;
  url?: string;
  args?: string[];
  tools?: string[];
  env?: Record<string, string>;
  headers?: Record<string, string>;
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
  target?: 'vscode' | 'github-copilot';
  tools?: string[] | string;
  model?: string;
  disableModelInvocation?: boolean;
  userInvocable?: boolean;
  argumentHint?: string;
  agents?: string[];
  handoffs?: SessionAgentHandoff[];
  mcpServers?: Record<string, SessionAgentMcpServer>;
  metadata?: Record<string, string>;
  hooks?: Record<string, Array<{ command: string; timeout?: number }>>;
}): string {
  const validHandoffs = dedupeHandoffs((params.handoffs ?? []).filter((handoff) => sanitizeLine(handoff.label) && sanitizeLine(handoff.agent) && sanitizeLine(handoff.prompt)));
  const cloudTarget = params.target === 'github-copilot';
  const agents = uniqueLines(params.agents ?? validHandoffs.map((handoff) => handoff.agent)).sort();
  const tools = normalizeAgentTools(params.tools, agents.length > 0 || validHandoffs.length > 0);
  const mcpServerLines = renderMcpServers(params.mcpServers);
  const cloudNotes = [
    ...(cloudTarget && agents.length > 0 ? [`GitHub Copilot cloud ignores VS Code handoffs; delegate explicitly to ${agents.join(', ')}.`] : []),
    ...(cloudTarget && params.argumentHint ? ['GitHub Copilot cloud ignores VS Code argument-hint.'] : [])
  ];
  const frontmatter = [
    '---',
    `name: ${params.slug}`,
    `description: ${yamlScalar(params.description)}`,
    ...(params.target ? [`target: ${params.target}`] : []),
    ...(params.model ? [`model: ${yamlScalar(sanitizeLine(params.model))}`] : []),
    ...(params.disableModelInvocation !== undefined ? [`disable-model-invocation: ${params.disableModelInvocation}`] : []),
    ...(params.userInvocable !== undefined ? [`user-invocable: ${params.userInvocable}`] : []),
    ...(params.argumentHint && params.target === 'vscode' ? [`argument-hint: ${yamlScalar(sanitizeLine(params.argumentHint))}`] : []),
    `tools: ${yamlInlineArray(tools)}`,
    ...(agents.length > 0 && !cloudTarget ? [`agents: ${yamlInlineArray(agents)}`] : []),
    ...(validHandoffs.length > 0 && !cloudTarget ? ['handoffs:', ...validHandoffs.flatMap(renderHandoff)] : []),
    ...mcpServerLines,
    ...(params.metadata && params.target !== 'vscode' ? renderMetadata(params.metadata) : []),
    ...(params.hooks && params.target === 'vscode' ? renderHooks(params.hooks) : []),
    '---'
  ].join('\n');
  const cloudNote = cloudNotes.length > 0 ? `\n${cloudNotes.join('\n')}\n` : '';
  return `${frontmatter}\n\nCall \`reason-with-lexicon\` first; output sketch-of-thought.\nGrammar hash: \`${params.grammarHash}\`.\nGrammar: \`${toPosixPath(params.grammarPath)}\`.\nTool registration: \`${toPosixPath(params.toolRegistrationPath)}\`.\nOutput contract: sketch-of-thought.\nFull prompt guidance: \`.utk/session-agents/references/${params.slug}.prompt.md\`.${cloudNote}\n`;
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function nonEmptyChoices(values: string[]): [string, ...string[]] {
  const unique = [...new Set(values)];
  return unique.length === 0 ? ['general'] : (unique as [string, ...string[]]);
}

function normalizeAgentSlug(value: string): string {
  if (!/[A-Za-z0-9]/.test(value)) return 'agent';
  const normalized = normalizeToolId(value).replace(/_/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return normalized || 'agent';
}

const MAX_DESCRIPTION_CHARS = 160;

function normalizeDescription(value: string): string {
  const sanitized = sanitizeLine(value)
    .replace(/\s+(?:name|tools|agents|handoffs|model|target):\s*(?:\[[^\]]*\]|"[^"]*"|'[^']*'|[^\s.]+)/gi, '')
    .trim();
  const prefixed = /^Use when\b/i.test(sanitized) ? sanitized : `Use when ${sanitized || 'this agent repeats'}`;
  const punctuated = /[.!?]$/.test(prefixed) ? prefixed : `${prefixed}.`;
  if (punctuated.length <= MAX_DESCRIPTION_CHARS) return punctuated;
  return `${punctuated.slice(0, MAX_DESCRIPTION_CHARS - 1).trimEnd().replace(/[.,;:!?-]+$/, '')}.`;
}

function sanitizeLine(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r?\n/g, ' ')
    .replace(/\s*---\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAgentTools(values: string[] | string | undefined, needsAgentTool: boolean): string[] {
  const rawTools = typeof values === 'string' ? values.split(',') : (values ?? ['reason-with-lexicon']);
  const tools = uniqueLines(rawTools.map((tool) => tool.replace(/^#tool:/, '').trim())).filter(isSafeToolName);
  if (tools.includes('*')) return ['*'];

  // Ensure "reason-with-lexicon" is present and placed first
  const hasReasonWithLexicon = tools.includes('reason-with-lexicon');
  const otherTools = tools.filter((tool) => tool !== 'reason-with-lexicon');

  // Add "agent" if needed
  if (needsAgentTool && !otherTools.includes('agent')) otherTools.push('agent');

  // Sanitize, deduplicate, and sort other tools
  const sanitizedOtherTools = uniqueLines(otherTools.map((tool) => sanitizeLine(tool)).filter(Boolean)).sort();

  // Return with "reason-with-lexicon" at the front
  return hasReasonWithLexicon ? ['reason-with-lexicon', ...sanitizedOtherTools] : sanitizedOtherTools;
}

function uniqueLines(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const sanitized = sanitizeLine(value);
    const key = sanitized.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(sanitized);
  }
  return result;
}

function yamlScalar(value: string): string {
  if (/^https?:\/\/\S+$/.test(value)) return value;
  if (/^[A-Za-z0-9][A-Za-z0-9 _.,;/$@+-]*$/.test(value) && !/\s#/.test(value)) return value;
  return JSON.stringify(value);
}

function yamlInlineArray(values: string[]): string {
  return `[${values.map((value) => JSON.stringify(value)).join(', ')}]`;
}

function renderHandoff(handoff: SessionAgentHandoff): string[] {
  return [
    `  - label: ${yamlScalar(sanitizeLine(handoff.label))}`,
    `    agent: ${yamlScalar(sanitizeLine(handoff.agent))}`,
    `    prompt: ${yamlScalar(sanitizeLine(handoff.prompt))}`,
    ...(handoff.send !== undefined ? [`    send: ${handoff.send}`] : []),
    ...(handoff.model ? [`    model: ${yamlScalar(sanitizeLine(handoff.model))}`] : [])
  ];
}

function dedupeHandoffs(handoffs: SessionAgentHandoff[]): SessionAgentHandoff[] {
  const seen = new Set<string>();
  const result: SessionAgentHandoff[] = [];
  for (const handoff of handoffs) {
    const key = `${sanitizeLine(handoff.label).toLowerCase()}\0${sanitizeLine(handoff.agent).toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(handoff);
  }
  return result;
}

function renderMcpServers(servers?: Record<string, SessionAgentMcpServer>): string[] {
  const entries = Object.entries(servers ?? {}).filter(([name, server]) => sanitizeLine(name) && (sanitizeLine(server.command ?? '') || sanitizeLine(server.url ?? '')));
  if (entries.length === 0) return [];
  const lines = ['mcp-servers:'];
  for (const [rawName, server] of entries.sort(([left], [right]) => left.localeCompare(right))) {
    const name = normalizeAgentSlug(rawName);
    lines.push(`  ${name}:`);
    if (server.type) lines.push(`    type: ${yamlScalar(sanitizeLine(server.type))}`);
    if (server.command) lines.push(`    command: ${yamlScalar(sanitizeLine(server.command))}`);
    if (server.url) lines.push(`    url: ${yamlScalar(sanitizeLine(server.url))}`);
    if (server.args && server.args.length > 0) {
      lines.push('    args:');
      for (const arg of server.args) lines.push(`      - ${yamlScalar(sanitizeLine(arg))}`);
    }
    if (server.tools && server.tools.length > 0) {
      lines.push('    tools:');
      for (const tool of uniqueLines(server.tools).sort()) lines.push(`      - ${yamlScalar(tool)}`);
    }
    if (server.env && Object.keys(server.env).length > 0) {
      lines.push('    env:');
      for (const [key, value] of Object.entries(server.env).sort(([left], [right]) => left.localeCompare(right))) lines.push(`      ${normalizeEnvKey(key)}: ${yamlScalar(sanitizeLine(value))}`);
    }
    if (server.headers && Object.keys(server.headers).length > 0) {
      lines.push('    headers:');
      for (const [key, value] of Object.entries(server.headers).sort(([left], [right]) => left.localeCompare(right))) lines.push(`      ${yamlScalar(sanitizeLine(key))}: ${yamlScalar(sanitizeLine(value))}`);
    }
  }
  return lines;
}

function renderMetadata(metadata: Record<string, string>): string[] {
  const entries = Object.entries(metadata).filter(([key]) => sanitizeLine(key));
  if (entries.length === 0) return [];
  return ['metadata:', ...entries.sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `  ${normalizeMetadataKey(key)}: ${yamlScalar(sanitizeLine(value))}`)];
}

function renderHooks(hooks: Record<string, Array<{ command: string; timeout?: number }>>): string[] {
  const entries = Object.entries(hooks)
    .map(([event, commands]) => {
      const sanitizedEvent = sanitizeLine(event);
      const sanitizedCommands = commands.map((c) => ({ sanitized: sanitizeLine(c.command), timeout: c.timeout })).filter((c) => c.sanitized);
      return { event: sanitizedEvent, commands: sanitizedCommands };
    })
    .filter((entry) => entry.event && entry.commands.length > 0);

  if (entries.length === 0) return [];
  const lines = ['hooks:'];
  for (const entry of entries.sort((left, right) => left.event.localeCompare(right.event))) {
    lines.push(`  ${yamlScalar(entry.event)}:`);
    for (const command of entry.commands) {
      lines.push(`    - command: ${yamlScalar(command.sanitized)}`);
      if (command.timeout !== undefined) lines.push(`      timeout: ${command.timeout}`);
    }
  }
  return lines;
}

function isSafeToolName(value: string): boolean {
  return value === '*' || /^[A-Za-z0-9_./@-]+$/.test(value);
}

function normalizeEnvKey(value: string): string {
  return sanitizeLine(value).replace(/[^A-Za-z0-9_]/g, '_') || 'ENV';
}

function normalizeMetadataKey(value: string): string {
  return normalizeAgentSlug(value);
}

function toPosixPath(value: string): string {
  return value.replace(/\\/g, '/');
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
