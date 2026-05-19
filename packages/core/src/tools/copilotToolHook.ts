import { mediateToolExecution, type MediatedResult, type ToolExecutor } from '../mediation/toolMediator.js';

export type CopilotToolHookSurface = {
  registerToolHook(handler: (toolId: string, input: unknown, executeOriginal: ToolExecutor) => Promise<string>): void;
};

export function registerUtkCopilotToolHook(surface: CopilotToolHookSurface, workspaceRoot: string): void {
  surface.registerToolHook(async (toolId, input, executeOriginal): Promise<string> => {
    const result: MediatedResult = await mediateToolExecution({ workspaceRoot, toolId, input, execute: executeOriginal });
    return result.response;
  });
}
