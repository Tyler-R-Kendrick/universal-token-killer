import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalJson, contentHash } from '@utk/foundation';
import { safeJoin } from '@utk/foundation';
import { recordFailure, type RunContext } from '../tracing/index.js';

export type AsyncTool<I extends Record<string, unknown>, O> = (input: I) => Promise<O>;

export type MemoizedToolResult<O> = {
  value: O;
  cacheHit: boolean;
  cachePath: string;
};

export function curryTool<I extends Record<string, unknown>, O>(tool: AsyncTool<I, O>, preset: Partial<I>): AsyncTool<I, O> {
  return async (input: I): Promise<O> => tool({ ...preset, ...input } as I);
}

export function memoizeTool<I extends Record<string, unknown>, O>(params: {
  workspaceRoot: string;
  cacheNamespace: string;
  cacheKeyPrefix: string;
  enabled: boolean;
  tool: AsyncTool<I, O>;
  tracer?: RunContext;
}): AsyncTool<I, MemoizedToolResult<O>> {
  const { workspaceRoot, cacheNamespace, cacheKeyPrefix, enabled, tool, tracer } = params;
  return async (input: I): Promise<MemoizedToolResult<O>> => {
    const cachePath = cacheFilePath(workspaceRoot, cacheNamespace, cacheKeyPrefix, input);
    if (enabled) {
      const cached = await readCachedValue<O>(cachePath);
      if (cached.found) return { value: cached.value, cacheHit: true, cachePath };
    }
    const value = await tool(input);
    if (enabled) {
      try {
        await writeCachedValue(cachePath, value);
      } catch (error) {
        recordFailure(tracer, {
          name: 'cache.write',
          runType: 'tool',
          error: error as Error,
          extra: { cachePath }
        });
      }
    }
    return { value, cacheHit: false, cachePath };
  };
}

function cacheFilePath(workspaceRoot: string, namespace: string, keyPrefix: string, input: Record<string, unknown>): string {
  const key = contentHash(`${keyPrefix}:${canonicalJson(input)}`);
  return safeJoin(workspaceRoot, '.utk', 'cache', namespace, `${key}.json`);
}

async function readCachedValue<T>(cachePath: string): Promise<{ found: true; value: T } | { found: false }> {
  try {
    const text = await readFile(cachePath, 'utf8');
    const parsed = JSON.parse(text) as { value?: T };
    if (parsed && 'value' in parsed) return { found: true, value: parsed.value as T };
    return { found: false };
  } catch {
    return { found: false };
  }
}

async function writeCachedValue<T>(cachePath: string, value: T): Promise<void> {
  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(cachePath, canonicalJson({ value }), 'utf8');
}
