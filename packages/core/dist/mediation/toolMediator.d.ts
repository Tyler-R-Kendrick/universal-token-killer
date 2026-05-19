export type ToolExecutor = (input: unknown) => Promise<unknown>;
export type MediatedResult = {
    response: string;
    schemaId: string;
    rawPath: string;
};
export declare function mediateToolExecution(params: {
    workspaceRoot: string;
    toolId: string;
    input: unknown;
    execute: ToolExecutor;
}): Promise<MediatedResult>;
