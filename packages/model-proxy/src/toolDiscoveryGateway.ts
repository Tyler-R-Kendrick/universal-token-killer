/* c8 ignore file -- exercised through model-proxy integration behavior tests. */
import {
  createToolCatalog,
  filterToolDefinitionsForIntent,
  type ToolDiscoveryMode,
  type ToolDiscoveryResult
} from '@utk/core';
import { estimateTokens, isObject, type JsonObject } from './openai.js';
import { minimizeToolSchemas } from './toolSchema.js';

export type ToolDiscoveryRequest = {
  workspaceRoot: string;
  request: JsonObject;
  query: string;
  mode: ToolDiscoveryMode;
  injectExpandContext: boolean;
  deferredEnabled: boolean;
  requiredToolNames: string[];
};

export async function applyToolDiscoveryToRequest(params: ToolDiscoveryRequest): Promise<ToolDiscoveryResult> {
  if (params.mode !== 'deferred-search' || !params.deferredEnabled) {
    return filterToolDefinitionsForIntent(params.request.tools, {
      intent: params.query,
      mode: params.mode,
      requiredToolNames: params.requiredToolNames
    });
  }

  const sourceTools = params.request.tools;
  const catalog = await createToolCatalog({
    workspaceRoot: params.workspaceRoot,
    requestId: metadataRequestId(params.request.metadata) ?? `req_${Date.now()}`,
    tools: sourceTools
  });
  params.request.metadata = { ...metadataObject(params.request.metadata), utk_tool_catalog_id: catalog.catalogId };

  const tools = deferredSearchTools(params.query, params.injectExpandContext);
  const beforeTokens = estimateTokens(JSON.stringify(sourceTools ?? []));
  const afterTokens = estimateTokens(JSON.stringify(tools));
  return {
    tools,
    removedToolNames: toolNames(sourceTools),
    beforeTokens,
    afterTokens,
    tokensSaved: Math.max(0, beforeTokens - afterTokens),
    routeReason: 'tool-discovery'
  };
}

function deferredSearchTools(query: string, injectExpandContext: boolean): JsonObject[] {
  const findOnly = filterToolDefinitionsForIntent([], {
    intent: query,
    mode: 'deferred-search',
    requiredToolNames: []
  });
  if (!injectExpandContext) return findOnly.tools;

  const expandContextTools = minimizeToolSchemas([], true).tools.filter((tool) => toolFunctionName(tool) === 'utk_expand_context');
  return [...expandContextTools, ...findOnly.tools];
}

function toolNames(tools: unknown): string[] {
  return Array.isArray(tools) ? tools.map(toolFunctionName).filter((name): name is string => Boolean(name)) : [];
}

function toolFunctionName(tool: unknown): string | undefined {
  if (!isObject(tool) || !isObject(tool.function)) return undefined;
  return typeof tool.function.name === 'string' ? tool.function.name : undefined;
}

function metadataObject(metadata: unknown): JsonObject {
  return isObject(metadata) ? metadata : {};
}

function metadataRequestId(metadata: unknown): string | undefined {
  return isObject(metadata) && typeof metadata.utk_request_id === 'string' ? metadata.utk_request_id : undefined;
}
