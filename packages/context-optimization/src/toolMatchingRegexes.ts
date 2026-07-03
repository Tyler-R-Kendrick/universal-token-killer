import { unique } from './toolMatchingCandidateAliases.js';

export type ToolRegex = {
  configured: boolean;
  pattern: RegExp;
};

const MAX_REGEX_SOURCE_LENGTH = 240;

export function buildToolRegexes(sources: string[], configuredRegexes: string[]): ToolRegex[] {
  const configured = new Set(configuredRegexes);
  return unique(sources)
    .map((source) => {
      const pattern = compileSafeRegex(source, 'iu');
      return pattern ? { configured: configured.has(source), pattern } : undefined;
    })
    .filter((regex): regex is ToolRegex => regex !== undefined);
}

function compileSafeRegex(source: string, flags: string): RegExp | undefined {
  if (source.length > MAX_REGEX_SOURCE_LENGTH) return undefined;
  if (/\\[1-9]/.test(source)) return undefined;
  if (/\(\?<([=!])/.test(source)) return undefined;
  const heuristicSource = source.replace(/\\s\+/g, 'WS');
  if (/\([^)]*(?:[A-Za-z0-9\]][+*]|\.\*)[^)]*\)[+*{]/.test(heuristicSource)) return undefined;
  if (/(?:\.\*){3,}/.test(source)) return undefined;
  try {
    return new RegExp(source, flags);
  } catch {
    return undefined;
  }
}
