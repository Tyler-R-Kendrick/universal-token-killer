import { type LanguageAdapter, type MinMap, type MinMapPatchOp, type ScannedToken } from '@utk/emission';
export type BuildSourceMinMapOptions = {
    baseMap?: MinMap;
    /** Identifiers shorter than this stay unmapped — renaming them cannot save tokens. */
    minLength?: number;
};
export type BuildSourceMinMapResult = {
    map: MinMap;
    patchOps: MinMapPatchOp[];
};
export declare const typescriptAdapter: LanguageAdapter;
export declare function buildSourceMinMap(source: string, options?: BuildSourceMinMapOptions): BuildSourceMinMapResult;
/**
 * Token-level walk. The standalone scanner does not re-scan template
 * continuations the way the parser does, so `}` tokens that close a template
 * substitution are re-scanned via `reScanTemplateToken` — tracked with a
 * brace-depth stack so object literals inside substitutions stay ordinary
 * braces. Re-scanned template middles/tails are reported as `other`.
 */
export declare function scanTypeScriptTokens(source: string): ScannedToken[];
