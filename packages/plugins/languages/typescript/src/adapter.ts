import ts from 'typescript';
import {
  allocateEntry,
  createMinMap,
  minIdFor,
  type LanguageAdapter,
  type MinMap,
  type MinMapPatchOp,
  type ScannedToken,
  type ScannedTokenKind
} from '@utk/emission';

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
  fileExtension: '.ts',
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
    for (const token of scanTypeScriptTokens(source)) {
      if (token.kind === 'identifier') {
        identifiers.add(token.text);
      }
    }
    return identifiers;
  },
  isParseable(source: string): boolean {
    return parseDiagnosticsAreClean(ts.createSourceFile('snippet.ts', source, ts.ScriptTarget.Latest, true));
  },
  scanTokens(source: string): ScannedToken[] {
    return scanTypeScriptTokens(source);
  }
};

/**
 * parseDiagnostics is internal compiler state — guard against the field
 * moving in a future typescript release instead of throwing at runtime.
 */
export function parseDiagnosticsAreClean(sourceFile: ts.SourceFile): boolean {
  const diagnostics = (sourceFile as unknown as { parseDiagnostics?: unknown[] }).parseDiagnostics;
  return Array.isArray(diagnostics) ? diagnostics.length === 0 : true;
}

export function buildSourceMinMap(source: string, options: BuildSourceMinMapOptions = {}): BuildSourceMinMapResult {
  const minLength = options.minLength ?? 3;
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const token of scanTypeScriptTokens(source)) {
    if (token.kind === 'identifier' && !seen.has(token.text)) {
      seen.add(token.text);
      ordered.push(token.text);
    }
  }

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

const TOKEN_KINDS = new Map<ts.SyntaxKind, ScannedTokenKind>([
  [ts.SyntaxKind.Identifier, 'identifier'],
  [ts.SyntaxKind.OpenParenToken, 'open-paren'],
  [ts.SyntaxKind.CloseParenToken, 'close-paren'],
  [ts.SyntaxKind.OpenBraceToken, 'open-brace'],
  [ts.SyntaxKind.CloseBraceToken, 'close-brace'],
  [ts.SyntaxKind.OpenBracketToken, 'open-bracket'],
  [ts.SyntaxKind.CloseBracketToken, 'close-bracket'],
  [ts.SyntaxKind.CommaToken, 'comma']
]);

/**
 * Token-level walk. The standalone scanner does not re-scan template
 * continuations the way the parser does, so `}` tokens that close a template
 * substitution are re-scanned via `reScanTemplateToken` — tracked with a
 * brace-depth stack so object literals inside substitutions stay ordinary
 * braces. Re-scanned template middles/tails are reported as `other`.
 */
export function scanTypeScriptTokens(source: string): ScannedToken[] {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, source);
  const templateBraceDepths: number[] = [];
  const tokens: ScannedToken[] = [];
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
        tokens.push({
          kind: 'other',
          text: source.slice(scanner.getTokenStart(), scanner.getTokenEnd()),
          start: scanner.getTokenStart(),
          end: scanner.getTokenEnd()
        });
        token = scanner.scan();
        continue;
      }
      braceDepth -= 1;
    } else if (token === ts.SyntaxKind.TemplateHead) {
      templateBraceDepths.push(braceDepth);
    }
    tokens.push({
      kind: TOKEN_KINDS.get(token) ?? 'other',
      text: source.slice(scanner.getTokenStart(), scanner.getTokenEnd()),
      start: scanner.getTokenStart(),
      end: scanner.getTokenEnd()
    });
    token = scanner.scan();
  }
  return tokens;
}

function renameIdentifiers(source: string, rename: (identifier: string) => string | undefined): string {
  const parts: string[] = [];
  let cursor = 0;
  for (const token of scanTypeScriptTokens(source)) {
    if (token.kind !== 'identifier') {
      continue;
    }
    const replacement = rename(token.text);
    if (replacement !== undefined) {
      parts.push(source.slice(cursor, token.start), replacement);
      cursor = token.end;
    }
  }
  parts.push(source.slice(cursor));
  return parts.join('');
}
