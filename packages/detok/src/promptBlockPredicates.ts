import type { PromptCompressionProtectedReason } from './promptSegmentTypes.js';

export function isStackTraceStart(line: string): boolean {
  return /^(?:[A-Za-z]*Error|TypeError|ReferenceError|SyntaxError|RangeError|Caused by:)/.test(line);
}

export function isStackTraceLine(line: string): boolean {
  return isStackTraceStart(line) || /^\s+at\s+/.test(line) || /^\s*\.\.\. \d+ more/.test(line);
}

export function isHttpStart(line: string): boolean {
  return /^(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+\S+\s+HTTP\/\d(?:\.\d)?$/.test(line) || /^HTTP\/\d(?:\.\d)?\s+\d{3}\b/.test(line);
}

export function isSqlStart(line: string): boolean {
  return /^(?:SELECT|INSERT|UPDATE|DELETE|WITH|EXPLAIN|CREATE|ALTER|DROP)\b/i.test(line);
}

export function isSqlLine(line: string): boolean {
  return isSqlStart(line) || /^\s+(?:AND|OR|FROM|WHERE|JOIN|GROUP|ORDER|LIMIT)\b/i.test(line);
}

export function isGraphqlStart(line: string): boolean {
  return /^(?:query|mutation|subscription)\b/.test(line);
}

export function isCronLine(line: string): boolean {
  const cronField = String.raw`(?:\*|\d+|\d+-\d+|\d+\/\d+|\*\/\d+|[\d,]+)`;
  return new RegExp(String.raw`^(?:[A-Z_][A-Z0-9_]*=\S+\s+)?(?:@\w+\s+\S+|${cronField}\s+${cronField}\s+${cronField}\s+${cronField}\s+${cronField}\s+\S+)`).test(line);
}

export function isDelimitedDataStart(lines: string[], index: number): boolean {
  const current = lines[index] ?? '';
  const next = lines[index + 1] ?? '';
  return (current.includes(',') && next.includes(',')) || (current.includes('\t') && next.includes('\t'));
}

export function isYamlStart(lines: string[], index: number): boolean {
  const current = lines[index] ?? '';
  const next = lines[index + 1] ?? '';
  return /^[A-Za-z][A-Za-z0-9_-]*:\s+\S/.test(current) && (/^[A-Za-z][A-Za-z0-9_-]*:\s*/.test(next) || /^(?: {2,}|\t)\S/.test(next));
}

export function isYamlLine(line: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_-]*:\s*/.test(line) || /^(?: {2,}|\t)\S/.test(line);
}

export function isDockerfileStart(line: string): boolean {
  return /^FROM\s+\S+/i.test(line);
}

export function isDockerfileLine(line: string): boolean {
  return /^(?:FROM|WORKDIR|COPY|ADD|RUN|CMD|ENTRYPOINT|ENV|ARG|EXPOSE|LABEL|USER|VOLUME|SHELL|HEALTHCHECK)\b/i.test(line);
}

export function isLogLine(line: string): boolean {
  return /^(?:\d{4}-\d{2}-\d{2}T|\[\d{4}-\d{2}-\d{2}\s)/.test(line);
}

export function isSecretFormatStart(line: string): boolean {
  const trimmed = line.trim();
  return /^-----BEGIN [A-Z ]+-----$/.test(trimmed) || /^(?:JWT|B64)=/.test(trimmed);
}

export function isSecretFormatLine(line: string): boolean {
  const trimmed = line.trim();
  return /^-----BEGIN [A-Z ]+-----$/.test(trimmed) || /^-----END [A-Z ]+-----$/.test(trimmed) || /^[A-Za-z0-9+/=._-]{24,}$/.test(trimmed) || /^(?:JWT|B64)=/.test(trimmed);
}

export function classifyProtectedLine(line: string): PromptCompressionProtectedReason | undefined {
  if (/(?:s3|gs|vscode|file):\/\/?|urn:|@sha256:|sha256:/.test(line)) return 'resource-id';
  if (/(?:[A-Za-z0-9_.\/-]+\.\.[A-Za-z0-9_.\/-]+|HEAD~\d+|refs\/[A-Za-z0-9_./-]+|[A-Fa-f0-9]{7,}\^!)/.test(line)) return 'vcs-ref';
  if (/(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2}|:\d+)?|\[[0-9A-Fa-f:]+\]:\d+|(?:[0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}/.test(line)) return 'network-id';
  if (/\b(?:css|xpath)=/.test(line)) return 'selector';
  if (/\$\([^)\n]+\)|\$\{[^}\n]+\}|%[A-Za-z_][A-Za-z0-9_]*%|\$env:[A-Za-z_][A-Za-z0-9_]*/.test(line)) return 'expansion';
  if (/(?:Ctrl|Alt|Shift|Cmd)(?:\+[A-Za-z0-9]+)+(?:\s+Cmd\+[A-Za-z0-9]+)?|[A-Za-z]+(?:\s*>\s*[A-Za-z]+){2,}/.test(line)) return 'keyboard';
  if (/\u001b\[[0-9;]*m|^PS\s+[A-Za-z]:\\/.test(line)) return 'terminal';
  if ((/\b(?:regex|pattern)\b/i.test(line) || /^\s*Use\s+\//.test(line)) && (/(?:^|\s)\/\^?[^\s\n]+\/[gimsuy]*(?:\s|$)/.test(line) || /\(\?[a-z]+\)[^\s,]+/.test(line))) return 'regex';
  if (!/@[A-Za-z0-9_.-]+\//.test(line) && /(?:>=\d+(?:\.\d+)*(?:\s+<\d+(?:\.\d+)*)?|\^\d+\.\d+\.\d+|~\d+\.\d+\.\d+|\b\d+\.\d+\.\d+(?:[-+][A-Za-z0-9_.-]+)?)/.test(line)) return 'version';
  return undefined;
}

export function isListStart(line: string): boolean {
  return /^\s*(?:[-*+] \[[ xX]\]|(?:\d+\.|[-*+])\s+)/.test(line);
}

export function isConfigLine(line: string): boolean {
  return /^[A-Z_][A-Z0-9_]*=.+/.test(line);
}

export function isDefinitionListStart(lines: string[], index: number): boolean {
  return Boolean((lines[index] ?? '').trim()) && /^\s*:\s+/.test(lines[index + 1] ?? '');
}

export function isMarkdownTableStart(lines: string[], index: number): boolean {
  const current = lines[index] ?? '';
  const next = lines[index + 1] ?? '';
  return /\|/.test(current) && /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(next);
}
