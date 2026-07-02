import ts from 'typescript';
import { allocateEntry } from '../minmap/allocator.js';
import { createMinMap, minIdFor, type MinMap } from '../minmap/format.js';
import type { MinMapPatchOp } from '../minmap/patch.js';
import type { LanguageAdapter } from './adapter.js';

export type BuildSourceMinMapOptions = {
  baseMap?: MinMap;
  /** Identifiers shorter than this stay unmapped — renaming them cannot save tokens. */
  minLength?: number;
};

export type BuildSourceMinMapResult = {
  map: MinMap;
  patchOps: MinMapPatchOp[];
};

export const typescriptAdapter: LanguageAdapter = {
  language: 'typescript',
  minify(source: string, map: MinMap): string {
    const rename = new Map<string, string>();
    const guards = new Set<string>();
    for (const entry of map.entries) {
      if (entry.kind !== 'ident') {
        continue;
      }
      rename.set(entry.pretty, entry.minId);
      guards.add(entry.minId);
    }
    return renameIdentifiers(source, (identifier) => {
      const replacement = rename.get(identifier);
      if (replacement !== undefined) {
        return replacement;
      }
      if (guards.has(identifier)) {
        throw new Error(`Source identifier '${identifier}' collides with min-map id '${identifier}'`);
      }
      return undefined;
    });
  },
  expand(source: string, map: MinMap): string {
    const rename = new Map<string, string>();
    const guards = new Set<string>();
    for (const entry of map.entries) {
      if (entry.kind !== 'ident') {
        continue;
      }
      rename.set(entry.minId, entry.pretty);
      guards.add(entry.pretty);
    }
    return renameIdentifiers(source, (identifier) => {
      const replacement = rename.get(identifier);
      if (replacement !== undefined) {
        return replacement;
      }
      if (guards.has(identifier)) {
        throw new Error(`Minified source contains pretty name '${identifier}'`);
      }
      return undefined;
    });
  },
  collectIdentifiers(source: string): Set<string> {
    const identifiers = new Set<string>();
    scanIdentifiers(source, (identifier) => {
      identifiers.add(identifier);
      return undefined;
    });
    return identifiers;
  },
  isParseable(source: string): boolean {
    const sourceFile = ts.createSourceFile('snippet.ts', source, ts.ScriptTarget.Latest, true);
    const diagnostics = (sourceFile as unknown as { parseDiagnostics: unknown[] }).parseDiagnostics;
    return diagnostics.length === 0;
  }
};

export function buildSourceMinMap(source: string, options: BuildSourceMinMapOptions = {}): BuildSourceMinMapResult {
  const minLength = options.minLength ?? 3;
  const ordered: string[] = [];
  const seen = new Set<string>();
  scanIdentifiers(source, (identifier) => {
    if (!seen.has(identifier)) {
      seen.add(identifier);
      ordered.push(identifier);
    }
    return undefined;
  });

  let map = options.baseMap ?? createMinMap('typescript');
  const patchOps: MinMapPatchOp[] = [];
  for (const identifier of ordered) {
    if (identifier.length < minLength || minIdFor(map, identifier) !== undefined) {
      continue;
    }
    const allocated = allocateEntry(map, {
      pretty: identifier,
      kind: 'ident',
      provenance: 'new',
      reserved: seen
    });
    map = allocated.map;
    patchOps.push({ op: 'add', minId: allocated.entry.minId, pretty: identifier, kind: 'ident' });
  }
  return { map, patchOps };
}

function renameIdentifiers(source: string, rename: (identifier: string) => string | undefined): string {
  const parts: string[] = [];
  let cursor = 0;
  scanIdentifiers(source, (identifier, start, end) => {
    const replacement = rename(identifier);
    if (replacement !== undefined) {
      parts.push(source.slice(cursor, start), replacement);
      cursor = end;
    }
    return undefined;
  });
  parts.push(source.slice(cursor));
  return parts.join('');
}

/**
 * Token-level identifier walk. The standalone scanner does not re-scan
 * template continuations the way the parser does, so `}` tokens that close a
 * template substitution are re-scanned via `reScanTemplateToken` — tracked
 * with a brace-depth stack so object literals inside substitutions stay
 * ordinary braces.
 */
function scanIdentifiers(source: string, visit: (identifier: string, start: number, end: number) => void): void {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, source);
  const templateBraceDepths: number[] = [];
  let braceDepth = 0;
  let token = scanner.scan();
  while (token !== ts.SyntaxKind.EndOfFileToken) {
    if (token === ts.SyntaxKind.OpenBraceToken) {
      braceDepth += 1;
    } else if (token === ts.SyntaxKind.CloseBraceToken) {
      const expected = templateBraceDepths[templateBraceDepths.length - 1];
      if (expected === braceDepth) {
        token = scanner.reScanTemplateToken(false);
        if (token !== ts.SyntaxKind.TemplateMiddle) {
          templateBraceDepths.pop();
        }
        token = scanner.scan();
        continue;
      }
      braceDepth -= 1;
    } else if (token === ts.SyntaxKind.TemplateHead) {
      templateBraceDepths.push(braceDepth);
    } else if (token === ts.SyntaxKind.Identifier) {
      visit(source.slice(scanner.getTokenStart(), scanner.getTokenEnd()), scanner.getTokenStart(), scanner.getTokenEnd());
    }
    token = scanner.scan();
  }
}
