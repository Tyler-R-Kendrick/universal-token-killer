import type { UtkConfig } from '../config/config.js';
import type { ToolRegex } from './toolMatchingRegexes.js';

export type ToolCandidate = {
  name: string;
  tool: Record<string, unknown>;
  description: string;
  parameters: Record<string, unknown>;
  required: string[];
  registry?: UtkConfig['tools']['registry'][number];
  aliases: string[];
  slashAliases: string[];
  regexes: ToolRegex[];
  defaultArgs: Record<string, unknown>;
  bypassOnMatch: boolean;
  protected: boolean;
  denied: boolean;
  searchLike: boolean;
  embeddingText: string;
};
