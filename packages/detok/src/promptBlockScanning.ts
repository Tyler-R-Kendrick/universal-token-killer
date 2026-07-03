import {
  scanAdmonition,
  scanBlockquote,
  scanConfig,
  scanConflict,
  scanDefinitionList,
  scanDiff,
  scanFence,
  scanFrontmatter,
  scanHtml,
  scanIndentedCode,
  scanList,
  scanMarkdownTable,
  scanMathBlock
} from './promptMarkdownBlockScanners.js';
import {
  scanClassifiedLine,
  scanCron,
  scanDelimitedData,
  scanDockerfile,
  scanGraphql,
  scanHttp,
  scanLog,
  scanSecretFormat,
  scanSql,
  scanStackTrace,
  scanYaml
} from './promptStructuredBlockScanners.js';
import { splitPromptLines, type PromptBlockScan, type PromptBlockScanner } from './promptBlockScannerTypes.js';

export { splitPromptLines } from './promptBlockScannerTypes.js';

const PROMPT_BLOCK_SCANNERS: readonly PromptBlockScanner[] = [
  scanFrontmatter,
  scanFence,
  scanBlockquote,
  scanConflict,
  scanDiff,
  scanHttp,
  scanSql,
  scanGraphql,
  scanStackTrace,
  scanCron,
  scanDelimitedData,
  scanYaml,
  scanDockerfile,
  scanLog,
  scanSecretFormat,
  scanClassifiedLine,
  scanMathBlock,
  scanAdmonition,
  scanDefinitionList,
  scanList,
  scanConfig,
  scanMarkdownTable,
  scanHtml,
  scanIndentedCode
];

export function findProtectedBlock(lines: string[], index: number): PromptBlockScan | undefined {
  for (const scanner of PROMPT_BLOCK_SCANNERS) {
    const scan = scanner(lines, index);
    if (scan) return scan;
  }
  return undefined;
}

export function isNaturalBlockBoundary(lines: string[], index: number): boolean {
  return (lines[index] ?? '').trim() === '---' || findProtectedBlock(lines, index) !== undefined;
}
