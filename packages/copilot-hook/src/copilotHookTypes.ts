type CopilotHookCommandBase = {
  type: 'command';
  cwd?: string;
  env?: Record<string, string>;
  matcher?: string;
  timeoutSec?: number;
};

export type CopilotHookCommand =
  | (CopilotHookCommandBase & { bash: string; powershell?: string; command?: string })
  | (CopilotHookCommandBase & { powershell: string; bash?: string; command?: string })
  | (CopilotHookCommandBase & { command: string; bash?: string; powershell?: string });

export type CopilotHookHttp = {
  type: 'http';
  url: string;
  headers?: Record<string, string>;
  allowedEnvVars?: string[];
  matcher?: string;
  timeoutSec?: number;
};

export type CopilotHookPrompt = {
  type: 'prompt';
  prompt: string;
};

export type CopilotHookEntry = CopilotHookCommand | CopilotHookHttp | CopilotHookPrompt;

export type CopilotHookConfig = {
  version: 1;
  hooks: Partial<Record<CopilotHookEventName, CopilotHookEntry[]>>;
};

export type CopilotHookEventName =
  | 'agentStop'
  | 'AgentStop'
  | 'errorOccurred'
  | 'ErrorOccurred'
  | 'notification'
  | 'Notification'
  | 'permissionRequest'
  | 'PermissionRequest'
  | 'postToolUse'
  | 'PostToolUse'
  | 'postToolUseFailure'
  | 'PostToolUseFailure'
  | 'preCompact'
  | 'PreCompact'
  | 'preToolUse'
  | 'PreToolUse'
  | 'sessionEnd'
  | 'SessionEnd'
  | 'sessionStart'
  | 'SessionStart'
  | 'subagentStart'
  | 'SubagentStart'
  | 'subagentStop'
  | 'SubagentStop'
  | 'userPromptSubmitted'
  | 'UserPromptSubmit';

export type CopilotPreToolUseCamelInput = {
  sessionId?: string;
  timestamp?: number;
  cwd?: string;
  toolName: string;
  toolArgs: unknown;
};

export type CopilotPreToolUseVsCodeInput = {
  hook_event_name?: 'PreToolUse';
  session_id?: string;
  timestamp?: string;
  cwd?: string;
  tool_name: string;
  tool_input: unknown;
};

export type CopilotPreToolUseInput = CopilotPreToolUseCamelInput | CopilotPreToolUseVsCodeInput;

export type CopilotPreToolUseOutput = {
  permissionDecision?: 'allow' | 'deny' | 'ask';
  permissionDecisionReason?: string;
  modifiedArgs?: unknown;
};
