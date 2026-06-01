import { recordFailure } from '../tracing/index.js';
import type { LintFinding, LintOptions, LintReport } from './lintPackTypes.js';

export function recordLintFindings(packDir: string, findings: LintFinding[], options: LintOptions): void {
  if (!options.tracer) return;
  for (const finding of findings) {
    recordFailure(options.tracer, {
      name: finding.code,
      runType: 'parser',
      error: { name: finding.severity, message: finding.message },
      extra: {
        severity: finding.severity,
        packDir,
        file: finding.file,
        hint: finding.hint
      }
    });
  }
}

export function summarizeLintFindings(findings: LintFinding[]): LintReport {
  let errors = 0;
  let warnings = 0;
  let infos = 0;
  for (const finding of findings) {
    if (finding.severity === 'error') errors += 1;
    else if (finding.severity === 'warning') warnings += 1;
    else infos += 1;
  }
  return {
    ok: errors === 0,
    findings,
    errorCount: errors,
    warningCount: warnings,
    infoCount: infos
  };
}
