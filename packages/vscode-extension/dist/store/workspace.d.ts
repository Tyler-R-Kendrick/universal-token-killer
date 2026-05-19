export declare function initializeWorkspaceStore(workspaceRoot: string): Promise<string>;
export declare function cleanupObservations(storageRoot: string, toolIds?: string[]): Promise<number>;
export declare function validateArtifacts(storageRoot: string): Promise<string[]>;
export declare function quarantineInvalidArtifacts(storageRoot: string): Promise<number>;
export declare function rebuildRoutes(storageRoot: string): Promise<void>;
export declare function compactSchemaHistory(storageRoot: string): Promise<number>;
