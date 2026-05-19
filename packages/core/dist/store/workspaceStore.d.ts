export declare const DEFAULT_CONFIG: {
    readonly version: 1;
    readonly mode: "copilot-only";
    readonly storageRoot: ".utk";
    readonly structuredOutput: {
        readonly canonical: readonly ["json-schema", "toon"];
        readonly decoder: "llguidance.ts";
        readonly fallback: "validate-and-retry";
        readonly maxRetries: 2;
    };
    readonly router: {
        readonly strategy: "deterministic-first";
        readonly agentEnabledBelowConfidence: 0.95;
        readonly maxRouteCandidatesPerTool: 8;
        readonly maxRouterPromptTokens: 700;
        readonly maxRouterOutputTokens: 32;
        readonly persistRoutingTelemetry: true;
    };
    readonly returnPolicy: {
        readonly default: "reference-only";
        readonly includeDiskPath: true;
        readonly includeSchemaId: true;
        readonly includeSchemaSummary: false;
        readonly maxInlineChars: 400;
    };
    readonly schemaPolicy: {
        readonly schemaIdFormat: "<normalized-tool-id>.v<N>.<short-content-hash>";
        readonly historyRetention: "keep-all-until-explicit-compact";
        readonly markTentativeOnInit: true;
    };
    readonly ruleEngine: {
        readonly allowedRuleKinds: readonly ["constant", "homogeneous-array", "optional-field", "required-field", "enum-candidate", "format", "range", "cardinality", "free-text", "opaque"];
        readonly forbidUseCaseSpecificRules: true;
        readonly forbidCliSpecificRules: true;
    };
};
export type WorkspaceInitResult = {
    storageRoot: string;
    configPath: string;
};
export declare function initializeWorkspaceStore(workspaceRoot: string): Promise<WorkspaceInitResult>;
