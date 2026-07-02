import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { contentHash } from '../artifact/canonical.js';
import { safeJoin } from '../security/pathSafety.js';
import { estimateTokens } from '../tokens.js';

type JsonObject = Record<string, unknown>;

export type ToolDiscoveryMode = 'off' | 'static-filter' | 'deferred-search';

export type ToolDiscoveryResult = {
  tools: JsonObject[];
  removedToolNames: string[];
  beforeTokens: number;
  afterTokens: number;
  tokensSaved: number;
  routeReason: 'tool-discovery' | 'tool-discovery-off';
};

export type ToolCatalog = {
  catalogId: string;
  requestId: string;
  toolCount: number;
  path: string;
  tools: JsonObject[];
};

export function filterToolDefinitionsForIntent(tools: unknown, options: {
  intent: string;
  mode?: ToolDiscoveryMode;
  requiredToolNames?: string[];
  protectedToolNames?: string[];
}): ToolDiscoveryResult {
  const source = Array.isArray(tools) ? tools.filter(isObject).map(cloneObject) : [];
  const beforeTokens = estimateTokens(JSON.stringify(source));
  const mode = options.mode ?? 'static-filter';
  if (mode === 'off') {
    return { tools: source, removedToolNames: [], beforeTokens, afterTokens: beforeTokens, tokensSaved: 0, routeReason: 'tool-discovery-off' };
  }

  const required = new Set(options.requiredToolNames ?? []);
  const protectedNames = new Set(options.protectedToolNames ?? []);
  const intentTokens = new Set(tokenize(options.intent));
  const nonRecoveryTools = source.filter((tool) => {
    const name = toolName(tool);
    return name && !name.startsWith('utk_');
  });
  const kept = source.filter((tool) => {
    const name = toolName(tool);
    if (!name) return true;
    if (required.has(name) || protectedNames.has(name) || name.startsWith('utk_')) return true;
    if (nonRecoveryTools.length <= 1) return true;
    const fn = toolFunction(tool);
    const text = `${name} ${String(fn?.description ?? '')}`;
    return tokenize(text).some((token) => hasTokenOverlap(intentTokens, token));
  });
  if (mode === 'deferred-search' && !kept.some((tool) => toolName(tool) === 'utk_find_tool')) {
    kept.push(buildFindToolDefinition());
  }
  const keptNames = new Set(kept.map(toolName).filter(Boolean));
  const removedToolNames = source.map(toolName).filter((name): name is string => Boolean(name && !keptNames.has(name)));
  const afterTokens = estimateTokens(JSON.stringify(kept));
  return { tools: kept, removedToolNames, beforeTokens, afterTokens, tokensSaved: Math.max(0, beforeTokens - afterTokens), routeReason: 'tool-discovery' };
}

export async function createToolCatalog(params: {
  workspaceRoot: string;
  requestId: string;
  tools: unknown;
}): Promise<ToolCatalog> {
  const tools = Array.isArray(params.tools) ? params.tools.filter(isObject).map(cloneObject) : [];
  const catalogId = `utkc_${contentHash(JSON.stringify({ requestId: params.requestId, tools }), 16)}`;
  const catalogRoot = safeJoin(params.workspaceRoot, '.utk', 'model-proxy', 'tool-catalogs');
  await mkdir(catalogRoot, { recursive: true });
  const catalogPath = safeJoin(catalogRoot, `${catalogId}.json`);
  const catalog = { catalogId, requestId: params.requestId, toolCount: tools.length, tools };
  await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  return { ...catalog, path: catalogPath };
}

export async function findToolDefinition(workspaceRoot: string, request: {
  catalogId: string;
  query: string;
  intent?: string;
  requiredToolNames?: string[];
}): Promise<{ catalogId: string; tool?: JsonObject; score: number; reason: string }> {
  if (!/^utkc_[a-f0-9]{16}$/.test(request.catalogId)) throw new Error('Invalid tool catalog id');
  const catalog = await readToolCatalog(workspaceRoot, request.catalogId);
  const required = new Set(request.requiredToolNames ?? []);
  const queryTokens = new Set(tokenize(`${request.query} ${request.intent ?? ''}`));
  let best: { tool?: JsonObject; score: number } = { score: 0 };
  for (const tool of catalog.tools) {
    const name = toolName(tool) ?? '';
    if (required.has(name)) return { catalogId: request.catalogId, tool, score: 100, reason: 'required-tool' };
    const fn = toolFunction(tool);
    const text = `${name} ${String(fn?.description ?? '')} ${JSON.stringify(fn?.parameters ?? {})}`;
    const score = tokenize(text).reduce((sum, token) => sum + (hasTokenOverlap(queryTokens, token) ? 1 : 0), 0);
    if (score > best.score) best = { tool, score };
  }
  return { catalogId: request.catalogId, tool: best.score > 0 ? best.tool : undefined, score: best.score, reason: best.score > 0 ? 'query-match' : 'no-match' };
}

async function readToolCatalog(workspaceRoot: string, catalogId: string): Promise<ToolCatalog> {
  const catalogPath = safeJoin(workspaceRoot, '.utk', 'model-proxy', 'tool-catalogs', `${catalogId}.json`);
  const parsed = JSON.parse(await readFile(ensureInside(workspaceRoot, catalogPath), 'utf8')) as unknown;
  if (!isObject(parsed)) throw new Error('Invalid tool catalog');
  const tools = Array.isArray(parsed.tools) ? parsed.tools.filter(isObject).map(cloneObject) : [];
  return {
    catalogId: stringValue(parsed.catalogId) ?? catalogId,
    requestId: stringValue(parsed.requestId) ?? '',
    toolCount: numberValue(parsed.toolCount) ?? tools.length,
    path: catalogPath,
    tools
  };
}

function ensureInside(workspaceRoot: string, filePath: string): string {
  const resolved = path.resolve(filePath);
  const root = path.resolve(workspaceRoot);
  if (!resolved.startsWith(`${root}${path.sep}`) && resolved !== root) throw new Error('Path traversal blocked');
  return resolved;
}

function toolFunction(tool: JsonObject): JsonObject | undefined {
  return isObject(tool.function) ? tool.function : undefined;
}

function toolName(tool: JsonObject): string | undefined {
  const fn = toolFunction(tool);
  return typeof fn?.name === 'string' ? fn.name : undefined;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9_]+/).map((token) => token.replace(/s$/, '')).filter((token) => token.length > 2);
}

function hasTokenOverlap(intentTokens: Set<string>, token: string): boolean {
  for (const intent of intentTokens) {
    if (intent === token || intent.includes(token) || token.includes(intent)) return true;
  }
  return false;
}


function buildFindToolDefinition(): JsonObject {
  return {
    type: 'function',
    function: {
      name: 'utk_find_tool',
      description: 'Find deferred tool schema by name or intent.',
      parameters: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string', description: 'Tool name or task intent.' }
        },
        additionalProperties: false
      }
    }
  };
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function cloneObject(value: JsonObject): JsonObject {
  const cloned = JSON.parse(JSON.stringify(value)) as unknown;
  return isObject(cloned) ? cloned : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}
