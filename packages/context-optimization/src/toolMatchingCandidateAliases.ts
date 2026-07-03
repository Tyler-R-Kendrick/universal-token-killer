import { toolLexicalProfile } from './toolLexicalProfiles.js';
import { nameTokens, significantPhrases } from './toolLexicalScoring.js';
import { regexPhrase } from './toolText.js';

export function defaultAliases(name: string, description: string, parameterNames: string[]): string[] {
  const tokens = nameTokens(name);
  const phrase = tokens.join(' ');
  const aliases = [name, phrase, ...nameVariantAliases(name)];
  if (tokens.length > 1) aliases.push(`${tokens[0]} ${tokens.slice(1).join(' ')}`);
  aliases.push(...toolLexicalProfile(name).aliases);
  if (parameterNames.length > 0) aliases.push(`${tokens[0] ?? name} ${parameterNames[0]}`);
  for (const chunk of significantPhrases(description)) aliases.push(chunk);
  return unique(aliases.map((alias) => alias.trim()).filter(Boolean));
}

export function slashAliasesFor(name: string, aliases: string[]): string[] {
  return unique([
    `/${name}`,
    `/${name.replace(/_/g, '-')}`,
    `/${name.replace(/_/g, '.')}`,
    ...aliases.map((alias) => `/${alias.replace(/\s+/g, '-')}`)
  ]);
}

export function generatedRegexes(name: string, aliases: string[]): string[] {
  const regexes = aliases.map((alias) => `(?:^|\\b)(?:please\\s+)?${regexPhrase(alias)}\\b(?<tail>[\\s\\S]*)$`);
  return unique([...regexes, ...toolLexicalProfile(name).regexes]);
}

export function normalizeCommandKey(value: string): string {
  return value.toLowerCase().replace(/[-.]/g, '_').replace(/\s+/g, '_');
}

export function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function nameVariantAliases(name: string): string[] {
  return [name.replace(/_/g, '-'), name.replace(/_/g, '.'), name.replace(/[_\-.]+/g, ' ')];
}
