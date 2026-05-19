declare module '@utk/core' {
  export type PackSource =
    | { type: 'local'; path: string }
    | { type: 'tarball'; path: string }
    | { type: 'git'; url: string; ref?: string }
    | { type: 'npm'; spec: string };

  export type InstalledPack = {
    name: string;
    version: string;
    source: string;
    revision: string;
    contentHash: string;
    installedAt: string;
    tools: string[];
    templates: string[];
    grammars: Array<{
      tool: string;
      field: string;
      larkHash: string;
      seedObservations: number;
      seedHash: string | null;
    }>;
  };

  export type UtkPackManifest = {
    pack: {
      name: string;
      version: string;
      description?: string;
      license?: string;
      authors?: string[];
      homepage?: string;
      keywords?: string[];
    };
    compatibility?: { utk?: string; pack_spec?: string };
    tools?: Array<Record<string, unknown>>;
    grammars?: Array<Record<string, unknown>>;
    templates?: Array<Record<string, unknown>>;
  };

  export function parsePackSource(spec: string): PackSource;
  export function installPack(
    workspaceRoot: string,
    source: PackSource,
    options?: { force?: boolean; now?: () => Date }
  ): Promise<InstalledPack>;
  export function uninstallPack(workspaceRoot: string, name: string): Promise<void>;
  export function listInstalledPacks(workspaceRoot: string): Promise<InstalledPack[]>;
  export function loadPackManifest(packDir: string): Promise<UtkPackManifest>;

  export type LintSeverity = 'error' | 'warning' | 'info';
  export type LintFinding = {
    severity: LintSeverity;
    code: string;
    message: string;
    file?: string;
    hint?: string;
  };
  export type LintReport = {
    ok: boolean;
    findings: LintFinding[];
    errorCount: number;
    warningCount: number;
    infoCount: number;
  };
  export type LintOptions = {
    importTemplate?: (filePath: string) => Promise<unknown>;
    recommendedFields?: boolean;
  };

  export function lintPack(packDir: string, options?: LintOptions): Promise<LintReport>;
  export function formatLintReport(report: LintReport, packLabel: string): string;
}
