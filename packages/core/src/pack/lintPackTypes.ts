import type { RunContext } from '@utk/tracing';

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
  tracer?: RunContext;
};
