import { MIN_ID_PATTERN } from '../minmap/format.js';

export type DeriveMinGrammarOptions = {
  /** Min-map macro ids to expose as single-token macro-call productions. */
  macroIds?: string[];
};

const MIN_IDENT_TERMINAL = 'IDENT: /[A-Za-z][A-Za-z0-9]{0,2}/';

const PATCH_PRODUCTIONS = [
  'patch_block: "@minmap" patch_line+ "@end"',
  'patch_line: patch_add | patch_remove | patch_rename',
  'patch_add: "+" IDENT PRETTY patch_kind?',
  'patch_remove: "-" IDENT',
  'patch_rename: "~" IDENT PRETTY',
  'patch_kind: "@ident" | "@macro" | "@keyword"',
  'PRETTY: /[A-Za-z_$][A-Za-z0-9_$]*/'
];

/**
 * Deterministically derive the token-optimized min-grammar from a base
 * emission grammar:
 *
 * 1. Identifiers are constrained to pool-shaped min ids, and a `patch_block`
 *    is prepended to `start` so a new symbol is only introducible by first
 *    emitting its min-map binding ("declare-before-use").
 * 2. Comments and blank lines are stripped and rule names are renamed to
 *    compact sequential ids, so the grammar itself costs fewer prompt tokens.
 *
 * The committed `grammars/typescript.emit.min.lark` must byte-equal this
 * function's output — a staleness test enforces it.
 */
export function deriveMinGrammar(baseLark: string, options: DeriveMinGrammarOptions = {}): string {
  const lines = baseLark
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('//'));

  const startIndex = lines.findIndex((line) => line.startsWith('start:'));
  if (startIndex === -1) {
    throw new Error('Emission grammar must declare a start rule');
  }
  const identIndex = lines.findIndex((line) => line.startsWith('IDENT:'));
  if (identIndex === -1) {
    throw new Error('Emission grammar must declare an IDENT terminal');
  }

  lines[startIndex] = lines[startIndex]!.replace('start:', 'start: patch_block?');
  lines[identIndex] = MIN_IDENT_TERMINAL;

  const withPatches = [...lines];
  const ignoreIndex = withPatches.findIndex((line) => line.startsWith('%ignore'));
  withPatches.splice(ignoreIndex, 0, ...PATCH_PRODUCTIONS, ...macroProductions(options.macroIds ?? []));

  return `${renameRules(withPatches).join('\n')}\n`;
}

function macroProductions(macroIds: string[]): string[] {
  if (macroIds.length === 0) {
    return [];
  }
  for (const macroId of macroIds) {
    if (!MIN_ID_PATTERN.test(macroId)) {
      throw new Error(`Emission grammar macro id '${macroId}' must match ${MIN_ID_PATTERN}`);
    }
  }
  return [
    'macro_call: MACRO_ID "(" macro_args? ")"',
    'macro_args: PRETTY ("," PRETTY)*',
    `MACRO_ID: ${macroIds.map((macroId) => `"${macroId}"`).join(' | ')}`
  ];
}

function renameRules(lines: string[]): string[] {
  const ruleNames: string[] = [];
  for (const line of lines) {
    const match = /^([a-z][a-z0-9_]*):/.exec(line);
    if (match && match[1] !== 'start') {
      ruleNames.push(match[1]!);
    }
  }
  const renames = new Map<string, string>(ruleNames.map((name, index) => [name, `r${index}`]));
  return lines.map((line) => replaceOutsideLiterals(line, renames));
}

/** Rule references are renamed only outside quoted literals and regex terminals. */
function replaceOutsideLiterals(line: string, renames: Map<string, string>): string {
  const segments = line.split(/("(?:[^"\\]|\\.)*"|\/(?:[^/\\]|\\.)*\/)/g);
  return segments
    .map((segment, index) => {
      if (index % 2 === 1) {
        return segment;
      }
      return segment.replace(/[a-z][a-z0-9_]*/g, (word) => renames.get(word) ?? word);
    })
    .join('');
}
