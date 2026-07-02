import type { LanguageAdapter } from './adapter.js';
import { typescriptAdapter } from './typescript.js';

export function resolveLanguageAdapter(language: string): LanguageAdapter {
  if (language === 'typescript') {
    return typescriptAdapter;
  }
  throw new Error(`No language adapter is registered for language '${language}'`);
}
