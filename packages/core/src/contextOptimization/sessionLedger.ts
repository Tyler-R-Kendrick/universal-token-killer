import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { safeJoin } from '../security/pathSafety.js';
import { ensureInside } from './artifactRecovery.js';

type JsonObject = Record<string, unknown>;

export type RetentionPolicy = 'off' | 'observe' | 'compact';
export type DedupePolicy = RetentionPolicy;
export type StaleErrorPolicy = RetentionPolicy;

export type SessionContextLedgerEvent = {
  messageId: string;
  toolCallId: string;
  turn: number;
  role: string;
  toolName: string;
  input: unknown;
  content: string;
  rawTokens: number;
  compactTokens: number;
  artifactId?: string;
  artifactPath?: string;
  routeId?: string;
  schemaId?: string;
  decision: string;
  status?: 'ok' | 'error';
  toolIdentity: string;
};

export type SessionContextLedger = {
  recordToolEvent(event: Omit<SessionContextLedgerEvent, 'messageId' | 'toolCallId' | 'toolIdentity'> & {
    messageId?: string;
    toolCallId?: string;
  }): Promise<SessionContextLedgerEvent>;
  applyRetentionPolicy(events: SessionContextLedgerEvent[], options: {
    currentTurn: number;
    dedupePolicy?: DedupePolicy;
    staleErrorPolicy?: StaleErrorPolicy;
    purgeErrorAfterTurns?: number;
    protectedToolNames?: string[];
  }): {
    deduped: SessionContextLedgerEvent[];
    purgedErrors: SessionContextLedgerEvent[];
    retained: SessionContextLedgerEvent[];
  };
};

export function createSessionContextLedger(options: { workspaceRoot: string; sessionId: string }): SessionContextLedger {
  let messageCounter = 0;
  let toolCounter = 0;
  let initialized = false;

  async function initializeCounters(): Promise<void> {
    if (initialized) return;
    initialized = true;
    const sessionPath = safeJoin(options.workspaceRoot, '.utk', 'model-proxy', 'sessions', `${options.sessionId}.jsonl`);
    try {
      const lines = (await readFile(ensureInside(options.workspaceRoot, sessionPath), 'utf8')).split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        const event = parseLedgerEventId(line);
        messageCounter = Math.max(messageCounter, idNumber(event.messageId, 'm'));
        toolCounter = Math.max(toolCounter, idNumber(event.toolCallId, 't'));
      }
    } catch {
      // New session.
    }
  }

  return {
    async recordToolEvent(event) {
      await initializeCounters();
      const recorded: SessionContextLedgerEvent = {
        ...event,
        messageId: event.messageId ?? nextId('m', ++messageCounter),
        toolCallId: event.toolCallId ?? nextId('t', ++toolCounter),
        toolIdentity: `${event.toolName}:${stableJson(event.input)}`
      };
      const sessionPath = safeJoin(options.workspaceRoot, '.utk', 'model-proxy', 'sessions', `${options.sessionId}.jsonl`);
      await mkdir(path.dirname(sessionPath), { recursive: true });
      await appendFile(sessionPath, `${JSON.stringify(recorded)}\n`, 'utf8');
      return recorded;
    },
    applyRetentionPolicy(events, retention) {
      const dedupePolicy = retention.dedupePolicy ?? 'off';
      const staleErrorPolicy = retention.staleErrorPolicy ?? 'off';
      const protectedToolPatterns = retention.protectedToolNames ?? [];
      const deduped = dedupePolicy === 'off' ? [] : findDedupedEvents(events, protectedToolPatterns);
      const purgedErrors = staleErrorPolicy === 'off' ? [] : findStaleErrorEvents(events, retention);
      const removed = new Set([
        ...(dedupePolicy === 'compact' ? deduped : []),
        ...(staleErrorPolicy === 'compact' ? purgedErrors : [])
      ].map((event) => event.messageId));
      return { deduped, purgedErrors, retained: events.filter((event) => !removed.has(event.messageId)) };
    }
  };
}

export function nextId(prefix: string, value: number): string {
  return `${prefix}${String(value).padStart(4, '0')}`;
}

export function idNumber(id: string | undefined, prefix: string): number {
  const match = new RegExp(`^${prefix}(\\d+)$`).exec(id ?? '');
  return match ? Number(match[1]) : 0;
}

function parseLedgerEventId(line: string): { messageId?: string; toolCallId?: string } {
  try {
    const parsed: unknown = JSON.parse(line);
    if (!isObject(parsed)) return {};
    return {
      messageId: typeof parsed.messageId === 'string' ? parsed.messageId : undefined,
      toolCallId: typeof parsed.toolCallId === 'string' ? parsed.toolCallId : undefined
    };
  } catch {
    return {};
  }
}

function findDedupedEvents(events: SessionContextLedgerEvent[], protectedToolPatterns: string[]): SessionContextLedgerEvent[] {
  const latestByIdentity = new Map<string, SessionContextLedgerEvent>();
  for (const event of events) {
    if (!matchesAnyPattern(event.toolName, protectedToolPatterns)) latestByIdentity.set(event.toolIdentity, event);
  }
  return events.filter((event) => !matchesAnyPattern(event.toolName, protectedToolPatterns) && latestByIdentity.get(event.toolIdentity)?.messageId !== event.messageId);
}

function findStaleErrorEvents(events: SessionContextLedgerEvent[], retention: {
  currentTurn: number;
  purgeErrorAfterTurns?: number;
  protectedToolNames?: string[];
}): SessionContextLedgerEvent[] {
  return events.filter((event) =>
    event.status === 'error' &&
    !matchesAnyPattern(event.toolName, retention.protectedToolNames ?? []) &&
    retention.purgeErrorAfterTurns !== undefined &&
    retention.currentTurn - event.turn >= retention.purgeErrorAfterTurns
  );
}

function matchesAnyPattern(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => pattern.endsWith('*') ? value.startsWith(pattern.slice(0, -1)) : value === pattern);
}

function stableJson(value: unknown): string {
  if (!isObject(value) && !Array.isArray(value)) return JSON.stringify(value);
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortJson(value[key])]));
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
