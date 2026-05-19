import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { safeJoin } from '../security/pathSafety.js';
import { canonicalJson } from '../artifact/canonical.js';
import { routeToToon } from '../toon/toon.js';
import type { RouteDecision } from '../router/router.js';

export type ArtifactIssue = {
  path: string;
  kind: 'invalid-json' | 'missing-required' | 'toon-drift';
  message: string;
};

export async function validateArtifacts(storageRoot: string): Promise<ArtifactIssue[]> {
  const issues: ArtifactIssue[] = [];
  for (const file of await walk(storageRoot)) {
    if (!file.endsWith('.json')) continue;
    try {
      JSON.parse(await readFile(file, 'utf8'));
    } catch {
      issues.push({ path: file, kind: 'invalid-json', message: 'invalid json' });
    }
  }
  return issues;
}

export async function quarantineInvalidArtifacts(storageRoot: string): Promise<ArtifactIssue[]> {
  const issues = await validateArtifacts(storageRoot);
  const quarantineRoot = safeJoin(storageRoot, 'quarantine');
  await mkdir(quarantineRoot, { recursive: true });
  for (const issue of issues) {
    const relative = path.relative(storageRoot, issue.path).replaceAll(path.sep, '__');
    await rename(issue.path, safeJoin(quarantineRoot, relative));
  }
  return issues;
}

export async function rebuildRouteIndex(storageRoot: string): Promise<RouteDecision[]> {
  const toolsRoot = safeJoin(storageRoot, 'tools');
  const routesRoot = safeJoin(storageRoot, 'routes');
  await mkdir(routesRoot, { recursive: true });
  const routes: RouteDecision[] = [];

  for (const tool of await safeReadDir(toolsRoot)) {
    const history = safeJoin(toolsRoot, tool, 'history');
    const schemaIds = (await safeReadDir(history)).filter((file) => file.endsWith('.schema.json')).map((file) => file.replace(/\.schema\.json$/, ''));
    if (schemaIds.length === 0) continue;
    routes.push({ schema: schemaIds[0]!, confidence: 0.95, reason: 'tool_match' });
  }

  await writeFile(safeJoin(routesRoot, 'index.json'), canonicalJson({ routes }), 'utf8');
  await writeFile(safeJoin(routesRoot, 'index.toon'), `${JSON.stringify({ routes })}\n`, 'utf8');
  await writeFile(safeJoin(routesRoot, 'index.min.toon'), `${routes.map((route) => routeToToon(route.schema, route.confidence, route.reason)).join('\n')}\n`, 'utf8');
  return routes;
}

export async function cleanupObservations(storageRoot: string, toolIds?: string[]): Promise<number> {
  const toolsRoot = safeJoin(storageRoot, 'tools');
  let removed = 0;
  for (const tool of await safeReadDir(toolsRoot)) {
    if (toolIds && !toolIds.includes(tool)) continue;
    const observations = safeJoin(toolsRoot, tool, 'observations');
    for (const run of await safeReadDir(observations)) {
      await rm(safeJoin(observations, run), { recursive: true, force: true });
      removed += 1;
    }
  }
  return removed;
}

export async function compactSchemaHistory(storageRoot: string): Promise<number> {
  const toolsRoot = safeJoin(storageRoot, 'tools');
  let removed = 0;
  for (const tool of await safeReadDir(toolsRoot)) {
    const history = safeJoin(toolsRoot, tool, 'history');
    const schemas = (await safeReadDir(history)).filter((file) => file.endsWith('.schema.json')).sort();
    const keep = schemas.at(-1);
    for (const schema of schemas) {
      if (schema === keep || schema.includes('.validated.')) continue;
      await rm(safeJoin(history, schema), { force: true });
      removed += 1;
    }
    if (schemas.length > 1) {
      await writeFile(safeJoin(history, 'compacted-summary.json'), canonicalJson({ kept: keep, removed }), 'utf8');
    }
  }
  return removed;
}

async function walk(root: string): Promise<string[]> {
  const entries = await safeReadDir(root);
  const files: string[] = [];
  for (const entry of entries) {
    const full = safeJoin(root, entry);
    const children = await safeReadDir(full);
    if (children.length > 0) {
      files.push(...(await walk(full)));
    } else {
      files.push(full);
    }
  }
  return files;
}

async function safeReadDir(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}
