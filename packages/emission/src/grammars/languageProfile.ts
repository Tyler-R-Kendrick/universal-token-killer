import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { atomicWriteFile, normalizeToolId, safeJoin } from '@utk/core';
import { deriveMinGrammar } from './deriveMinGrammar.js';
import { TYPESCRIPT_EMIT_LARK } from './typescriptEmitGrammar.js';

export type InstalledLanguageProfile = {
  language: string;
  grammarPath: string;
  minGrammarPath: string;
};

const LANGUAGE_GRAMMARS: Record<string, string> = {
  typescript: TYPESCRIPT_EMIT_LARK
};

export function languageGrammar(language: string): string {
  const grammar = LANGUAGE_GRAMMARS[language];
  if (grammar === undefined) {
    throw new Error(`No emission grammar profile is registered for language '${language}'`);
  }
  return grammar;
}

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
