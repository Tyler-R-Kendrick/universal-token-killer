import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { atomicWriteFile, normalizeToolId, safeJoin } from '@utk/core';
import { languageGrammar } from '../languages/registry.js';
import { deriveMinGrammar } from '@utk/minmap';

export type InstalledLanguageProfile = {
  language: string;
  grammarPath: string;
  minGrammarPath: string;
};

export async function installLanguageProfile(workspaceRoot: string, language: string): Promise<InstalledLanguageProfile> {
  const grammar = languageGrammar(language);
  const languageDir = safeJoin(workspaceRoot, '.utk', 'lang', normalizeToolId(language));
  await mkdir(languageDir, { recursive: true });
  const grammarPath = path.join(languageDir, 'grammar.lark');
  const minGrammarPath = path.join(languageDir, 'grammar.min.lark');
  await atomicWriteFile(grammarPath, grammar);
  await atomicWriteFile(minGrammarPath, deriveMinGrammar(grammar));
  return { language, grammarPath, minGrammarPath };
}
