import { lintGrammarEntries } from './lintPackGrammars.js';
import { lintRecommendedManifestFields, readManifestForLint } from './lintPackManifest.js';
import { lintPluginEntries } from './lintPackPlugins.js';
import { recordLintFindings, summarizeLintFindings } from './lintPackReport.js';
import { importTemplateForLint, lintTemplateEntries } from './lintPackTemplates.js';
import { lintToolEntries } from './lintPackTools.js';
import type { LintFinding, LintOptions, LintReport } from './lintPackTypes.js';

export { importTemplateForLint };
export type { LintFinding, LintOptions, LintReport, LintSeverity } from './lintPackTypes.js';

const DEFAULT_RECOMMENDED_FIELDS = true;

export async function lintPack(packDir: string, options: LintOptions = {}): Promise<LintReport> {
  const findings: LintFinding[] = [];
  const manifest = await readManifestForLint(packDir, findings);
  if (manifest) {
    if (options.recommendedFields ?? DEFAULT_RECOMMENDED_FIELDS) {
      lintRecommendedManifestFields(manifest, findings);
    }
    await lintToolEntries(packDir, manifest.tools ?? [], findings);
    await lintGrammarEntries(packDir, manifest.grammars ?? [], findings);
    await lintTemplateEntries(packDir, manifest, options, findings);
    await lintPluginEntries(packDir, manifest.plugins ?? [], findings);
  }
  recordLintFindings(packDir, findings, options);
  return summarizeLintFindings(findings);
}

export function formatLintReport(report: LintReport, packLabel: string): string {
  const lines: string[] = [];
  if (report.findings.length === 0) {
    lines.push(`OK ${packLabel} (no findings)`);
    return `${lines.join('\n')}\n`;
  }
  for (const finding of report.findings) {
    const file = finding.file ? ` (${finding.file})` : '';
    const hint = finding.hint ? ` — ${finding.hint}` : '';
    lines.push(`[${finding.severity.toUpperCase()}] ${finding.code}: ${finding.message}${file}${hint}`);
  }
  lines.push(`${report.errorCount} error(s), ${report.warningCount} warning(s), ${report.infoCount} info`);
  return `${lines.join('\n')}\n`;
}
