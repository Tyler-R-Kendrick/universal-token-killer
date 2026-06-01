export function classifyRouteReason(content: string, query: string): string {
  const trimmed = content.trim();
  if (/^(?:OK|File edited successfully\.?|Edited successfully\.?)$/im.test(content) || /File edited successfully/i.test(content)) return 'edit-loop';
  if (/^diff --git|^@@\s|^\+\+\+ |^--- /m.test(content)) return 'diff';
  if (/<type>file<\/type>|End of file|<path>.*<\/path>/i.test(content)) return 'file-read-envelope';
  if (/error TS\d+|FAIL|vitest|jest|pytest/i.test(content)) return 'test-error';
  if (/^[^:\r\n]+:\d+:\d?:?.+/m.test(content) || /\brg\b|\bgrep\b/i.test(query)) return 'search-results';
  if (/npm ERR!|pnpm ERR!|cargo (?:error|failed)|docker:|kubectl|terraform/i.test(content)) return 'build-log';
  if (trimmed.startsWith('[')) return 'structured-json-array';
  if (trimmed.startsWith('{')) return 'structured-json';
  if (/^(command|cmd|path|file):/im.test(content)) return 'tool-output';
  if (/```|command:|error TS\d+|npm ERR!|FAIL|at\s+\S+\s+\(/.test(content)) return 'protected-spans';
  if (/edit|oldString|End of file|<type>file<\/type>/i.test(content)) return 'edit-loop';
  if (/context|budget|token|headroom/i.test(query)) return 'context-pressure';
  if (/^\s*(INFO|WARN|ERROR|\[[^\]]+\])/.test(content)) return 'tool-output';
  return 'tool-output';
}

export function hasStructuredOrProtectedSignal(content: string): boolean {
  const trimmed = content.trim();
  return trimmed.startsWith('{') || trimmed.startsWith('[') || /```|command:|error TS\d+|npm ERR!|FAIL|at\s+\S+\s+\(/.test(content);
}
