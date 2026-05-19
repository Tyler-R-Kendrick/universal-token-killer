export type ToolManifest = {
    id: string;
    normalizedId: string;
    mode: 'copilot-only';
    inputSchemaPath: string;
    outputSchemaPath: string;
};
export declare function normalizeToolId(toolId: string): string;
export declare function schemaIdFor(normalizedToolId: string, version: number, schema: unknown, rules: unknown): string;
export declare function writeManifest(toolBase: string, toolId: string): Promise<ToolManifest>;
export declare function writeInputSchema(toolBase: string, input: unknown): Promise<void>;
