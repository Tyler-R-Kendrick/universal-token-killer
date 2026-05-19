export type JsonSchema = Record<string, unknown>;
export declare function inferSchema(value: unknown): JsonSchema;
export declare function inferTextPseudoSchema(text: string): JsonSchema;
