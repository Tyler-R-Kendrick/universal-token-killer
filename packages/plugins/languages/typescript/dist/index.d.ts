import { type LanguageEmissionPack } from '@utk/emission';
export { buildSourceMinMap, scanTypeScriptTokens, typescriptAdapter } from './adapter.js';
export type { BuildSourceMinMapOptions, BuildSourceMinMapResult } from './adapter.js';
export { TYPESCRIPT_PLATFORM_CAPABILITIES, TYPESCRIPT_STDLIB_CAPABILITIES } from './capabilities.js';
export { readPackGrammar, TYPESCRIPT_EMIT_LARK } from './grammar.js';
/**
 * Reference language pack for `@utk/emission`. Sibling languages (python,
 * java, kotlin, cpp, csharp, rust, ...) land as sibling folders under
 * `packages/plugins/languages/` implementing the same pack shape.
 */
export declare const typescriptLanguagePack: LanguageEmissionPack;
