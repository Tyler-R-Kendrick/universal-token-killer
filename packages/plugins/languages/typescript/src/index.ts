import { registerLanguagePack, type LanguageCodegenPack } from '@utk/codegen';
import { typescriptAdapter } from './adapter.js';
import { TYPESCRIPT_PLATFORM_CAPABILITIES, TYPESCRIPT_STDLIB_CAPABILITIES } from './capabilities.js';
import { TYPESCRIPT_EMIT_LARK } from './grammar.js';

export { buildSourceMinMap, scanTypeScriptTokens, typescriptAdapter } from './adapter.js';
export type { BuildSourceMinMapOptions, BuildSourceMinMapResult } from './adapter.js';
export { TYPESCRIPT_PLATFORM_CAPABILITIES, TYPESCRIPT_STDLIB_CAPABILITIES } from './capabilities.js';
export { TYPESCRIPT_EMIT_LARK } from './grammar.js';

/**
 * Reference language pack for `@utk/codegen`. Sibling languages (python,
 * java, kotlin, cpp, csharp, rust, ...) land as sibling folders under
 * `packages/plugins/languages/` implementing the same pack shape.
 */
export const typescriptLanguagePack: LanguageCodegenPack = {
  language: 'typescript',
  adapter: typescriptAdapter,
  grammar: TYPESCRIPT_EMIT_LARK,
  stdlibCapabilities: TYPESCRIPT_STDLIB_CAPABILITIES,
  platformCapabilities: TYPESCRIPT_PLATFORM_CAPABILITIES
};

// Importing the pack plugs the language in.
registerLanguagePack(typescriptLanguagePack);
