import type { VersionedSchema } from '../schema/mergeSchema.js';
export declare function readSchemaHistory(toolBase: string): Promise<VersionedSchema[]>;
export declare function markSchemaValidated(toolBase: string, schemaId: string): Promise<void>;
