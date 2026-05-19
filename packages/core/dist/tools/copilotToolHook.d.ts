import { type ToolExecutor } from '../mediation/toolMediator.js';
export type CopilotToolHookSurface = {
    registerToolHook(handler: (toolId: string, input: unknown, executeOriginal: ToolExecutor) => Promise<string>): void;
};
export declare function registerUtkCopilotToolHook(surface: CopilotToolHookSurface, workspaceRoot: string): void;
