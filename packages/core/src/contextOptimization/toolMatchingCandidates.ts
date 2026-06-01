import { resolveRegisteredTool, type UtkConfig } from '../config/config.js';
import {
  defaultAliases,
  generatedRegexes,
  normalizeCommandKey,
  slashAliasesFor,
  unique
} from './toolMatchingCandidateAliases.js';
import { collectToolDefinitions, isObject } from './toolMatchingCandidateSources.js';
import type { ToolCandidate } from './toolMatchingCandidateTypes.js';
import { buildToolRegexes, type ToolRegex } from './toolMatchingRegexes.js';
import { isSearchLike } from './toolLexicalScoring.js';

export type { ToolCandidate } from './toolMatchingCandidateTypes.js';
export type { ToolRegex } from './toolMatchingRegexes.js';

export function buildToolCandidates(tools: unknown, config: UtkConfig): ToolCandidate[] {
  return collectToolDefinitions(tools, config)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, tool]) => buildToolCandidate(name, tool, config));
}

export function findSlashCandidate(candidates: ToolCandidate[], command: string): ToolCandidate | undefined {
  const key = normalizeCommandKey(command);
  return candidates.find((candidate) => candidate.slashAliases.some((alias) => normalizeCommandKey(alias.replace(/^\//, '')) === key));
}

function buildToolCandidate(name: string, tool: Record<string, unknown>, config: UtkConfig): ToolCandidate {
  const fn = isObject(tool.function) ? tool.function : {};
  const registry = resolveRegisteredTool(config, name);
  const description = String(fn.description ?? registry?.description ?? '');
  const parameters = isObject(fn.parameters) ? fn.parameters : {};
  const properties = isObject(parameters.properties) ? parameters.properties : {};
  const required = Array.isArray(parameters.required) ? parameters.required.filter((item): item is string => typeof item === 'string') : [];
  const aliases = unique([
    ...defaultAliases(name, description, Object.keys(properties)),
    ...(registry?.lexical_aliases ?? [])
  ]);
  const configuredRegexes = registry?.lexical_regexes ?? [];

  return {
    name,
    tool,
    description,
    parameters,
    required,
    registry,
    aliases,
    slashAliases: slashAliasesFor(name, aliases),
    regexes: buildToolRegexes([...generatedRegexes(name, aliases), ...configuredRegexes], configuredRegexes),
    defaultArgs: registry?.default_args ?? {},
    bypassOnMatch: registry?.bypass_on_match ?? false,
    protected: matchesAnyPattern(name, config.model_proxy.protected_tools),
    denied: matchesAnyPattern(name, config.model_proxy.deny_tools),
    searchLike: isSearchLike(name, description, aliases),
    embeddingText: `${name} ${aliases.join(' ')} ${description} ${JSON.stringify(properties)}`
  };
}

function matchesAnyPattern(name: string, patterns: string[]): boolean {
  return patterns.some((pattern) => pattern.endsWith('*') ? name.startsWith(pattern.slice(0, -1)) : name === pattern);
}
