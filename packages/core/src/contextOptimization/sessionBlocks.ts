import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { safeJoin } from '../security/pathSafety.js';
import { estimateTokens } from '../tokens.js';
import { ensureInside, readArtifactRecords } from './artifactRecovery.js';
import { idNumber, nextId, type SessionContextLedgerEvent } from './sessionLedger.js';

type JsonObject = Record<string, unknown>;

export type SessionBlock = {
  blockId: string;
  sessionId: string;
  sourceMessageIds: string[];
  artifactIds: string[];
  routeIds: string[];
  schemaIds: string[];
  rawTokens: number;
  compactTokens: number;
  reservedOutputTokens: number;
  summary: string;
  path: string;
};

export async function compressSessionBlocks(params: {
  workspaceRoot: string;
  sessionId: string;
  events: SessionContextLedgerEvent[];
  budget: { shouldCompactHistory: boolean; reservedOutputTokens: number };
}): Promise<SessionBlock[]> {
  if (!params.budget.shouldCompactHistory || params.events.length === 0) return [];
  const blockId = await nextBlockId(params.workspaceRoot);
  const rawText = (await Promise.all(params.events.map((event) => rawEventContent(params.workspaceRoot, event)))).join('\n');
  const artifactIds = unique(params.events.map((event) => event.artifactId));
  const routeIds = unique(params.events.map((event) => event.routeId));
  const schemaIds = unique(params.events.map((event) => event.schemaId));
  const summary = [
    `[utk-block:${blockId}] history-summary`,
    `session=${params.sessionId}`,
    `messages=${params.events.map((event) => event.messageId).join(',')}`,
    `artifacts=${artifactIds.join(',')}`,
    `routes=${routeIds.join(',')}`,
    rawText.split(/\r?\n/).slice(0, 40).join('\n')
  ].filter(Boolean).join('\n');
  const blockRoot = safeJoin(params.workspaceRoot, '.utk', 'model-proxy', 'blocks');
  await mkdir(blockRoot, { recursive: true });
  const blockPath = safeJoin(blockRoot, `${blockId}.txt`);
  await writeFile(blockPath, summary, 'utf8');
  return [{
    blockId,
    sessionId: params.sessionId,
    sourceMessageIds: params.events.map((event) => event.messageId),
    artifactIds,
    routeIds,
    schemaIds,
    rawTokens: estimateTokens(rawText),
    compactTokens: estimateTokens(summary),
    reservedOutputTokens: params.budget.reservedOutputTokens,
    summary,
    path: blockPath
  }];
}

export async function compactHistoryForRequest(params: {
  workspaceRoot: string;
  sessionId: string;
  messages: JsonObject[];
  events: SessionContextLedgerEvent[];
  budget: { shouldCompactHistory: boolean; reservedOutputTokens: number };
  mode?: 'summary-block' | 'replace-with-summary-block';
}): Promise<{
  messages: JsonObject[];
  blocks: SessionBlock[];
  replacedMessageCount: number;
}> {
  const blocks = await compressSessionBlocks({
    workspaceRoot: params.workspaceRoot,
    sessionId: params.sessionId,
    events: params.events,
    budget: params.budget
  });
  if (blocks.length === 0) return { messages: params.messages, blocks, replacedMessageCount: 0 };
  const block = blocks[0];
  if (!block) return { messages: params.messages, blocks, replacedMessageCount: 0 };

  const visibleSummary = visibleBlockSummary(params.sessionId, block);
  const eventContents = new Set(params.events.map((event) => event.content));
  const eventNames = new Set(params.events.map((event) => event.toolName));
  const lastUserIndex = findLastIndex(params.messages, (message) => message.role === 'user');
  const nextMessages: JsonObject[] = [];
  let inserted = false;
  let replacedMessageCount = 0;
  for (let index = 0; index < params.messages.length; index += 1) {
    const message = params.messages[index];
    if (!message) continue;
    const isCurrentUser = index === lastUserIndex && message.role === 'user';
    const eligible = !isCurrentUser && isCompactableHistoryMessage(message, eventContents, eventNames);
    if (eligible && (params.mode ?? 'replace-with-summary-block') === 'replace-with-summary-block') {
      replacedMessageCount += 1;
      if (!inserted) {
        nextMessages.push({ role: 'developer', content: visibleSummary });
        inserted = true;
      }
      continue;
    }
    nextMessages.push(message);
  }
  if (!inserted) nextMessages.splice(Math.max(1, nextMessages.length - 1), 0, { role: 'developer', content: visibleSummary });
  return { messages: nextMessages, blocks, replacedMessageCount };
}

async function rawEventContent(workspaceRoot: string, event: SessionContextLedgerEvent): Promise<string> {
  if (!event.artifactPath) return event.content;
  try {
    return await readFile(ensureInside(workspaceRoot, event.artifactPath), 'utf8');
  } catch {
    return event.content;
  }
}

function visibleBlockSummary(sessionId: string, block: SessionBlock): string {
  return [
    `[utk-block:${block.blockId}] history-summary`,
    `session=${sessionId}`,
    `messages=${block.sourceMessageIds.join(',')}`,
    `artifacts=${block.artifactIds.join(',')}`,
    `routes=${block.routeIds.join(',')}`,
    `raw-recoverable=true`
  ].filter(Boolean).join('\n');
}

async function nextBlockId(workspaceRoot: string): Promise<string> {
  const blockRoot = safeJoin(workspaceRoot, '.utk', 'model-proxy', 'blocks');
  try {
    const records = await readArtifactRecords(workspaceRoot);
    const maxFromIndex = records.reduce((max, record) => Math.max(max, idNumber(record.blockId, 'b')), 0);
    const maxFromFiles = await readHighestBlockFileNumber(blockRoot);
    return nextId('b', Math.max(maxFromIndex, maxFromFiles) + 1);
  } catch {
    return 'b0001';
  }
}

async function readHighestBlockFileNumber(blockRoot: string): Promise<number> {
  try {
    const names = await readdir(blockRoot);
    return names.reduce((max, name) => Math.max(max, idNumber(path.basename(name, '.txt'), 'b')), 0);
  } catch {
    return 0;
  }
}

function isCompactableHistoryMessage(message: JsonObject, eventContents: Set<string>, eventNames: Set<string>): boolean {
  const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content ?? '');
  const name = typeof message.name === 'string' ? message.name : typeof message.tool_name === 'string' ? message.tool_name : '';
  if (message.role === 'tool') return true;
  if (eventContents.has(content)) return true;
  if (name && eventNames.has(name)) return true;
  return false;
}

function findLastIndex<T>(items: T[], predicate: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item !== undefined && predicate(item)) return index;
  }
  return -1;
}

function unique(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  return values.filter((value): value is string => {
    const clean = value?.trim();
    if (!clean || seen.has(clean)) return false;
    seen.add(clean);
    return true;
  });
}

