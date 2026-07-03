import { mergeAdjacentSegments } from './promptSegmentUtils.js';
import type { PromptCompressionProtectedReason, PromptCompressionRawSegment } from './promptSegmentTypes.js';

export function splitInlineProtectedSegments(text: string): PromptCompressionRawSegment[] {
  const segments: PromptCompressionRawSegment[] = [];
  const inlinePattern =
    /(`+[^`\n]*`+|"[^"\n]*(?:\\.[^"\n]*)*"|'[^'\n]*(?:\\.[^'\n]*)*'|\$\.[A-Za-z0-9_[\].-]+|\$\{\{[^}\n]+\}\}|\{\{[^}\n]+\}\}|<%[\s\S]*?%>|\$\$?[^$\n]+\$\$?|\{[^\n]+\}|\[[^\]\n]+(?:,[^\]\n]+)+\]|\[[A-Za-z0-9_.-]+\][^\n.]+|(?:s3|gs|vscode|file):\/\/?[^\s,]+|urn:[^\s,]+|[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.:-]+@sha256:[A-Fa-f0-9]{32,64}|sha256:[A-Fa-f0-9]{32,64}|!?\[[^\]\n]+\]\((?:[^()\n]|\([^()\n]*\))+\)|\[[^\]\n]+\]\[[^\]\n]+\]|^\[\^[^\]\n]+\]:[^\n]+|^\[[^\]\n]+\]:[^\n]+|\[\^[^\]\n]+\]|<https?:\/\/[^>\n]+>|<[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}>|https?:\/\/[^\s)>,]+|(?:node|npm|npx|pnpm|yarn|git|gh|pwsh|powershell|python|uv|npm.cmd)\b(?:\s+(?!(?:before|after|then|while|when|because|and|or)\b)(?:"[^"\n]*(?:\\.[^"\n]*)*"|'[^'\n]*(?:\\.[^'\n]*)*'|[^\s,;:]+))+|(?:[A-Z_][A-Z0-9_]*=[^\s]+\s+)+(?:node|npm|npx|pnpm|yarn|git|gh|pwsh|powershell|python|uv|npm.cmd)\b[^\n.]*|@[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:@[0-9A-Za-z_.-]+)?|[A-Fa-f0-9]{40}|[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12}|(?:[A-Za-z][A-Za-z0-9_.-]*\/[A-Za-z][A-Za-z0-9_.-]+)|(?:[A-Za-z]:\\)(?:(?!\s+(?:and|or|before|after|then|while|when|because|to|from)\b)[^,;\n])+|(?:\.?\.?\\)[^\s,;:]+(?:\\[^\s,;:]+)+|(?:\.{1,2}\/|\/|[A-Za-z0-9_.-]+\/)(?:[A-Za-z0-9_. -]+\/)*[A-Za-z0-9_. -]+\.[A-Za-z0-9]{1,8}|(?:#[0-9]+|gh-[0-9]+|@[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)|\$[.[\]A-Za-z0-9_-]+|[A-Za-z_$][A-Za-z0-9_$]*(?:\(\)|\.[A-Za-z0-9_$-]+)|[a-z]+[A-Z][A-Za-z0-9_$]*|[A-Z][A-Za-z0-9]*[A-Z][A-Za-z0-9]*|[A-Z][A-Z0-9_]{2,})/gm;
  let lastIndex = 0;
  for (const match of text.matchAll(inlinePattern)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ kind: 'natural_language', text: text.slice(lastIndex, index) });
    }
    const token = match[0];
    segments.push({
      kind: 'protected',
      text: token,
      reason: classifyInlineProtectedReason(token)
    });
    lastIndex = index + token.length;
  }
  if (lastIndex < text.length) {
    segments.push({ kind: 'natural_language', text: text.slice(lastIndex) });
  }
  return mergeAdjacentSegments(segments);
}

function classifyInlineProtectedReason(token: string): PromptCompressionProtectedReason {
  if (token.startsWith('`')) return 'inline-code';
  if (token.startsWith('"') || token.startsWith("'")) return 'quoted-string';
  if (/^\$[.[\]A-Za-z0-9_-]+$/.test(token)) return 'schema-reference';
  if (/^\$\$?/.test(token)) return 'math';
  if (/^(?:\{|\[[^\]\n]+(?:,[^\]\n]+)+\]|\[[A-Za-z0-9_.-]+\])/.test(token)) return 'data-literal';
  if (/^(?:\$\{\{|\{\{|<%)/.test(token)) return 'template';
  if (/^(?:(?:s3|gs|vscode|file|urn):\/\/?|[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.:-]+@sha256:|sha256:)/.test(token)) return 'resource-id';
  if (/^!?\[[^\]\n]+\]\((?:[^()\n]|\([^()\n]*\))+\)$/.test(token)) return 'markdown-link';
  if (/^\[[^\]\n]+\]\[[^\]\n]+\]$/.test(token)) return 'reference-link';
  if (/^(?:\[\^[^\]\n]+\]|\[\^[^\]\n]+\]:|\[[^\]\n]+\]:)/.test(token)) return 'reference';
  if (/^(?:<?https?:\/\/|<[A-Za-z0-9._%+-]+@)/.test(token)) return 'url';
  if (/^@[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:@[0-9A-Za-z_.-]+)?$/.test(token)) return 'package-name';
  if (/^[A-Fa-f0-9]{40}$|^[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12}$/.test(token)) return 'hash';
  if (/^[A-Za-z][A-Za-z0-9_.-]*\/[A-Za-z][A-Za-z0-9_.-]+$/.test(token)) return 'model-id';
  if (/^(?:[A-Za-z]:\\|\.?\.?\\|\.{1,2}\/|\/|(?:[A-Za-z0-9_-]+\/)+)/.test(token)) return 'filepath';
  if (/^(?:(?:[A-Z_][A-Z0-9_]*=[^\s]+\s+)+)?(?:node|npm|npx|pnpm|yarn|git|gh|pwsh|powershell|python|uv|npm.cmd)\b/.test(token)) return 'command';
  if (/^(?:#[0-9]+|gh-[0-9]+|@[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)$/.test(token)) return 'reference';
  return 'api-name';
}
