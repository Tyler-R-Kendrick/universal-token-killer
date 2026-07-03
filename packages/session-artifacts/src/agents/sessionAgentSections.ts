import type { SessionAgentHandoff, SessionAgentMcpServer } from './sessionAgentTypes.js';
import { normalizeAgentSlug, sanitizeLine, uniqueLines, yamlScalar } from './sessionAgentText.js';

export function normalizeAgentTools(values: string[] | string | undefined, needsAgentTool: boolean): string[] {
  const rawTools = typeof values === 'string' ? values.split(',') : (values ?? ['reason-with-lexicon']);
  const tools = uniqueLines(rawTools.map((tool) => tool.replace(/^#tool:/, '').trim())).filter(isSafeToolName);
  if (tools.includes('*')) return ['*'];

  const hasReasonWithLexicon = tools.includes('reason-with-lexicon');
  const otherTools = tools.filter((tool) => tool !== 'reason-with-lexicon');
  if (needsAgentTool && !otherTools.includes('agent')) otherTools.push('agent');
  const sanitizedOtherTools = uniqueLines(otherTools.map((tool) => sanitizeLine(tool)).filter(Boolean)).sort();
  return hasReasonWithLexicon ? ['reason-with-lexicon', ...sanitizedOtherTools] : sanitizedOtherTools;
}

export function renderHandoff(handoff: SessionAgentHandoff): string[] {
  return [
    `  - label: ${yamlScalar(sanitizeLine(handoff.label))}`,
    `    agent: ${yamlScalar(sanitizeLine(handoff.agent))}`,
    `    prompt: ${yamlScalar(sanitizeLine(handoff.prompt))}`,
    ...(handoff.send !== undefined ? [`    send: ${handoff.send}`] : []),
    ...(handoff.model ? [`    model: ${yamlScalar(sanitizeLine(handoff.model))}`] : [])
  ];
}

export function dedupeHandoffs(handoffs: SessionAgentHandoff[]): SessionAgentHandoff[] {
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

export function renderMcpServers(servers?: Record<string, SessionAgentMcpServer>): string[] {
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

export function renderMetadata(metadata: Record<string, string>): string[] {
  const entries = Object.entries(metadata).filter(([key]) => sanitizeLine(key));
  if (entries.length === 0) return [];
  return ['metadata:', ...entries.sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `  ${normalizeMetadataKey(key)}: ${yamlScalar(sanitizeLine(value))}`)];
}

export function renderHooks(hooks: Record<string, Array<{ command: string; timeout?: number }>>): string[] {
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
