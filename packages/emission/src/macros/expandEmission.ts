import type { LanguageAdapter, ScannedToken } from '../languages/adapter.js';
import type { MinMap } from '@utk/minmap';
import { expandMacro, type MacroDescriptor } from './defineMacro.js';

type MacroCallSite = {
  start: number;
  end: number;
  macro: MacroDescriptor;
  args: string[];
};

/**
 * Expand a fully-minified emission into pretty source: identifiers first
 * (macro-kind entries are untouched by the identifier renamer), then macro
 * call sites. Macro expansions must not themselves contain macro calls —
 * expansion is single-pass by design so `ultra`-mode output stays reviewable.
 */
export async function expandEmissionSource(
  source: string,
  map: MinMap,
  macros: MacroDescriptor[],
  adapter: LanguageAdapter
): Promise<string> {
  return await expandMacroCallsInSource(adapter.expand(source, map), map, macros, adapter);
}

export async function expandMacroCallsInSource(
  source: string,
  map: MinMap,
  macros: MacroDescriptor[],
  adapter: LanguageAdapter
): Promise<string> {
  const macroNames = new Set<string>();
  for (const macro of macros) {
    if (macroNames.has(macro.name)) {
      throw new Error(`Macro '${macro.name}' is registered more than once`);
    }
    macroNames.add(macro.name);
  }
  const macroPretty = new Map<string, string>();
  for (const entry of map.entries) {
    if (entry.kind === 'macro') {
      macroPretty.set(entry.minId, entry.pretty);
    }
  }
  const tokens = adapter.scanTokens(source);
  const sites: MacroCallSite[] = [];
  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index]!;
    if (token.kind !== 'identifier' || !macroPretty.has(token.text)) {
      index += 1;
      continue;
    }
    const openParen = tokens[index + 1];
    if (!openParen || openParen.kind !== 'open-paren') {
      index += 1;
      continue;
    }
    const site = collectCallSite(source, tokens, index, resolveMacro(macroPretty.get(token.text)!, macros), macroPretty);
    sites.push(site.callSite);
    index = site.nextIndex;
  }

  const parts: string[] = [];
  let cursor = 0;
  for (const site of sites) {
    parts.push(source.slice(cursor, site.start), await expandMacro(site.macro, site.args));
    cursor = site.end;
  }
  parts.push(source.slice(cursor));
  return parts.join('');
}

function resolveMacro(pretty: string, macros: MacroDescriptor[]): MacroDescriptor {
  const macro = macros.find((candidate) => candidate.name === pretty);
  if (!macro) {
    throw new Error(`Macro '${pretty}' has no registered descriptor`);
  }
  return macro;
}

function collectCallSite(
  source: string,
  tokens: ScannedToken[],
  identifierIndex: number,
  macro: MacroDescriptor,
  macroPretty: Map<string, string>
): { callSite: MacroCallSite; nextIndex: number } {
  const openParen = tokens[identifierIndex + 1]!;
  const argSlices: Array<{ start: number; end: number }> = [];
  let depth = 1;
  let argStart = openParen.end;
  let index = identifierIndex + 2;
  while (index < tokens.length) {
    const token = tokens[index]!;
    if (token.kind === 'identifier' && macroPretty.has(token.text)) {
      throw new Error(`Macro '${macro.name}' call contains a nested macro call '${token.text}'`);
    }
    if (token.kind === 'open-paren' || token.kind === 'open-brace' || token.kind === 'open-bracket') {
      depth += 1;
    } else if (token.kind === 'close-brace' || token.kind === 'close-bracket') {
      depth -= 1;
    } else if (token.kind === 'close-paren') {
      depth -= 1;
      if (depth === 0) {
        argSlices.push({ start: argStart, end: token.start });
        const args = argSlices
          .map((slice) => source.slice(slice.start, slice.end).trim())
          .filter((argText) => argText.length > 0);
        return {
          callSite: { start: tokens[identifierIndex]!.start, end: token.end, macro, args },
          nextIndex: index + 1
        };
      }
    } else if (token.kind === 'comma' && depth === 1) {
      argSlices.push({ start: argStart, end: token.start });
      argStart = token.end;
    }
    index += 1;
  }
  throw new Error(`Macro '${macro.name}' call site is unterminated`);
}
