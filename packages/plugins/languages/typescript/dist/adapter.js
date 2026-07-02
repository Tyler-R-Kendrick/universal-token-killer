import ts from 'typescript';
import { allocateEntry, createMinMap, minIdFor } from '@utk/emission';
export const typescriptAdapter = {
    language: 'typescript',
    fileExtension: '.ts',
    minify(source, map) {
        const rename = new Map();
        const guards = new Set();
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
    expand(source, map) {
        const rename = new Map();
        const guards = new Set();
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
    collectIdentifiers(source) {
        const identifiers = new Set();
        for (const token of scanTypeScriptTokens(source)) {
            if (token.kind === 'identifier') {
                identifiers.add(token.text);
            }
        }
        return identifiers;
    },
    isParseable(source) {
        const sourceFile = ts.createSourceFile('snippet.ts', source, ts.ScriptTarget.Latest, true);
        // parseDiagnostics is internal compiler state — guard against the field
        // moving in a future typescript release instead of throwing at runtime.
        const diagnostics = sourceFile.parseDiagnostics;
        return Array.isArray(diagnostics) ? diagnostics.length === 0 : true;
    },
    scanTokens(source) {
        return scanTypeScriptTokens(source);
    }
};
export function buildSourceMinMap(source, options = {}) {
    const minLength = options.minLength ?? 3;
    const ordered = [];
    const seen = new Set();
    for (const token of scanTypeScriptTokens(source)) {
        if (token.kind === 'identifier' && !seen.has(token.text)) {
            seen.add(token.text);
            ordered.push(token.text);
        }
    }
    let map = options.baseMap ?? createMinMap('typescript');
    const patchOps = [];
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
const TOKEN_KINDS = new Map([
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
export function scanTypeScriptTokens(source) {
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, source);
    const templateBraceDepths = [];
    const tokens = [];
    let braceDepth = 0;
    let token = scanner.scan();
    while (token !== ts.SyntaxKind.EndOfFileToken) {
        if (token === ts.SyntaxKind.OpenBraceToken) {
            braceDepth += 1;
        }
        else if (token === ts.SyntaxKind.CloseBraceToken) {
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
        }
        else if (token === ts.SyntaxKind.TemplateHead) {
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
function renameIdentifiers(source, rename) {
    const parts = [];
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
