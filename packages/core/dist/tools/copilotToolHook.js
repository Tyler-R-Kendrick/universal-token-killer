import { mediateToolExecution } from '../mediation/toolMediator.js';
export function registerUtkCopilotToolHook(surface, workspaceRoot) {
    surface.registerToolHook(async (toolId, input, executeOriginal) => {
        const result = await mediateToolExecution({ workspaceRoot, toolId, input, execute: executeOriginal });
        return result.response;
    });
}
