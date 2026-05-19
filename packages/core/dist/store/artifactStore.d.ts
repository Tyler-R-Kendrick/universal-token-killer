import { type RouteDecision } from '../router/router.js';
export type ArtifactIssue = {
    path: string;
    kind: 'invalid-json' | 'missing-required' | 'toon-drift';
    message: string;
};
export declare function validateArtifacts(storageRoot: string): Promise<ArtifactIssue[]>;
export declare function quarantineInvalidArtifacts(storageRoot: string): Promise<ArtifactIssue[]>;
export declare function rebuildRouteIndex(storageRoot: string): Promise<RouteDecision[]>;
export declare function cleanupObservations(storageRoot: string, toolIds?: string[]): Promise<number>;
export declare function compactSchemaHistory(storageRoot: string): Promise<number>;
