import type { SessionAgentHandoff, SessionAgentMcpServer } from './sessionAgentTypes.js';
import {
  dedupeHandoffs,
  normalizeAgentTools,
  renderHandoff,
  renderHooks,
  renderMcpServers,
  renderMetadata
} from './sessionAgentSections.js';
import {
  normalizeAgentSlug,
  normalizeDescription,
  sanitizeLine,
  toPosixPath,
  uniqueLines,
  yamlInlineArray,
  yamlScalar
} from './sessionAgentText.js';

export {
  normalizeAgentSlug,
  normalizeDescription,
  uniqueLines
} from './sessionAgentText.js';

export function renderSessionAgent(params: {
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
