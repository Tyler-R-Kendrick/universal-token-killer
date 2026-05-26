import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import type { Dirent } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { atomicWriteFile, buildCompactResponse, canonicalJson, safeJoin } from '@utk/core';
import ts from 'typescript';

export type CodeGraphLanguage = 'typescript' | 'javascript';

export type CodeGraphRange = {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  startOffset: number;
  endOffset: number;
};

export type CodeGraphSymbolKind =
  | 'function'
  | 'class'
  | 'interface'
  | 'type'
  | 'enum'
  | 'const'
  | 'let'
  | 'var'
  | 'method';

export type CodeGraphSymbol = {
  id: string;
  name: string;
  kind: CodeGraphSymbolKind;
  filePath: string;
  range: CodeGraphRange;
  selectionRange: CodeGraphRange;
  exported: boolean;
  defaultExport?: boolean;
  container?: string;
  signature: string;
  implements?: string[];
};

export type CodeGraphReference = {
  symbolId: string;
  name: string;
  filePath: string;
  range: CodeGraphRange;
  kind: 'declaration' | 'read' | 'write' | 'export';
};

export type CodeGraphPatch = {
  filePath: string;
  operation: 'replace' | 'insert_before' | 'insert_after' | 'delete' | 'rename';
  startOffset: number;
  endOffset: number;
  replacement: string;
  beforeHash: string;
};

export type CodeGraphOptions = {
  workspaceRoot: string;
  storageRoot?: string;
  enginePath?: string;
  languages?: CodeGraphLanguage[];
  ignoredGlobs?: string[];
  maxContextTokens?: number;
};

export type IndexProjectResult = {
  fileCount: number;
  symbolCount: number;
  referenceCount: number;
  storageRoot: string;
  diagnostics: Array<{ filePath: string; message: string }>;
};

export type ContextPackResult = {
  query: string;
  compactText: string;
  visibleTokens: number;
  rawTokenEstimate: number;
  tokenRatio: number;
  recoveryArtifacts: {
    artifactId: string;
    rawJsonPath: string;
    compactToonPath: string;
    compactResponse: string;
  };
  symbols: CodeGraphSymbol[];
};

export type CodeGraph = {
  indexProject(): Promise<IndexProjectResult>;
  getSymbolsOverview(input: { filePath?: string }): Promise<{ symbols: CodeGraphSymbol[] }>;
  findSymbol(input: { query: string; kind?: CodeGraphSymbolKind; filePath?: string; limit?: number }): Promise<CodeGraphSymbol[]>;
  findDefinition(input: { query?: string; filePath?: string; line?: number; column?: number }): Promise<{ symbol: CodeGraphSymbol } | undefined>;
  findReferences(input: { symbolId?: string; query?: string }): Promise<{ symbol: CodeGraphSymbol; references: CodeGraphReference[] }>;
  findImplementations(input: { symbolId?: string; query?: string }): Promise<{ symbol?: CodeGraphSymbol; symbols: CodeGraphSymbol[] }>;
  retrieveContext(input: { query: string; budgetTokens?: number; includeBodies?: boolean }): Promise<ContextPackResult>;
  replaceSymbolBody(input: { symbolId?: string; query?: string; newBody: string; apply?: boolean }): Promise<EditResult>;
  insertBeforeSymbol(input: { symbolId?: string; query?: string; text: string; apply?: boolean }): Promise<EditResult>;
  insertAfterSymbol(input: { symbolId?: string; query?: string; text: string; apply?: boolean }): Promise<EditResult>;
  safeDeleteSymbol(input: { symbolId?: string; query?: string; apply?: boolean }): Promise<EditResult & { blocked: boolean; references: CodeGraphReference[] }>;
  renameSymbol(input: { symbolId?: string; query?: string; newName: string; apply?: boolean }): Promise<EditResult>;
  getDiagnosticsForFile(input: { filePath: string }): Promise<{ diagnostics: CodeGraphDiagnostic[] }>;
};

export type EditResult = {
  applied: boolean;
  patches: CodeGraphPatch[];
  message: string;
};

export type CodeGraphDiagnostic = {
  filePath: string;
  code: number;
  category: 'warning' | 'error' | 'suggestion' | 'message';
  message: string;
  range?: CodeGraphRange;
};

export const CODE_GRAPH_MCP_TOOL_NAMES = [
  'code_graph_index_project',
  'code_graph_get_symbols_overview',
  'code_graph_find_symbol',
  'code_graph_find_definition',
  'code_graph_find_references',
  'code_graph_find_implementations',
  'code_graph_retrieve_context',
  'code_graph_replace_symbol_body',
  'code_graph_insert_before_symbol',
  'code_graph_insert_after_symbol',
  'code_graph_safe_delete_symbol',
  'code_graph_rename_symbol',
  'code_graph_get_diagnostics_for_file',
] as const;

export type CodeGraphMcpToolName = (typeof CODE_GRAPH_MCP_TOOL_NAMES)[number];

type SourceRecord = {
  filePath: string;
  absolutePath: string;
  content: string;
  sourceFile: ts.SourceFile;
};

type IndexState = {
  files: SourceRecord[];
  symbols: CodeGraphSymbol[];
  aliases: CodeGraphAlias[];
  references: CodeGraphReference[];
  indexed: boolean;
};

type CodeGraphAlias = {
  alias: string;
  target: string;
  filePath: string;
};

type ToolchainCheckOptions = {
  env?: NodeJS.ProcessEnv;
};

export function createCodeGraph(options: CodeGraphOptions): CodeGraph {
  return new LocalCodeGraph(options);
}

export async function indexProject(options: CodeGraphOptions): Promise<IndexProjectResult> {
  return createCodeGraph(options).indexProject();
}

export async function getSymbolsOverview(
  options: CodeGraphOptions,
  input: { filePath?: string },
): Promise<{ symbols: CodeGraphSymbol[] }> {
  return createCodeGraph(options).getSymbolsOverview(input);
}

export async function findSymbol(
  options: CodeGraphOptions,
  input: { query: string; kind?: CodeGraphSymbolKind; filePath?: string; limit?: number },
): Promise<CodeGraphSymbol[]> {
  const graph = createCodeGraph(options);
  await graph.indexProject();
  return graph.findSymbol(input);
}

export async function findDefinition(
  options: CodeGraphOptions,
  input: { query?: string; filePath?: string; line?: number; column?: number },
): Promise<{ symbol: CodeGraphSymbol } | undefined> {
  const graph = createCodeGraph(options);
  await graph.indexProject();
  return graph.findDefinition(input);
}

export async function findReferences(
  options: CodeGraphOptions,
  input: { symbolId?: string; query?: string },
): Promise<{ symbol: CodeGraphSymbol; references: CodeGraphReference[] }> {
  const graph = createCodeGraph(options);
  await graph.indexProject();
  return graph.findReferences(input);
}

export async function findImplementations(
  options: CodeGraphOptions,
  input: { symbolId?: string; query?: string },
): Promise<{ symbol?: CodeGraphSymbol; symbols: CodeGraphSymbol[] }> {
  const graph = createCodeGraph(options);
  await graph.indexProject();
  return graph.findImplementations(input);
}

export async function retrieveContext(
  options: CodeGraphOptions,
  input: { query: string; budgetTokens?: number; includeBodies?: boolean },
): Promise<ContextPackResult> {
  const graph = createCodeGraph(options);
  await graph.indexProject();
  return graph.retrieveContext(input);
}

export async function replaceSymbolBody(
  options: CodeGraphOptions,
  input: { symbolId?: string; query?: string; newBody: string; apply?: boolean },
): Promise<EditResult> {
  const graph = createCodeGraph(options);
  await graph.indexProject();
  return graph.replaceSymbolBody(input);
}

export async function insertBeforeSymbol(
  options: CodeGraphOptions,
  input: { symbolId?: string; query?: string; text: string; apply?: boolean },
): Promise<EditResult> {
  const graph = createCodeGraph(options);
  await graph.indexProject();
  return graph.insertBeforeSymbol(input);
}

export async function insertAfterSymbol(
  options: CodeGraphOptions,
  input: { symbolId?: string; query?: string; text: string; apply?: boolean },
): Promise<EditResult> {
  const graph = createCodeGraph(options);
  await graph.indexProject();
  return graph.insertAfterSymbol(input);
}

export async function safeDeleteSymbol(
  options: CodeGraphOptions,
  input: { symbolId?: string; query?: string; apply?: boolean },
): Promise<EditResult & { blocked: boolean; references: CodeGraphReference[] }> {
  const graph = createCodeGraph(options);
  await graph.indexProject();
  return graph.safeDeleteSymbol(input);
}

export async function renameSymbol(
  options: CodeGraphOptions,
  input: { symbolId?: string; query?: string; newName: string; apply?: boolean },
): Promise<EditResult> {
  const graph = createCodeGraph(options);
  await graph.indexProject();
  return graph.renameSymbol(input);
}

export async function getDiagnosticsForFile(
  options: CodeGraphOptions,
  input: { filePath: string },
): Promise<{ diagnostics: CodeGraphDiagnostic[] }> {
  return createCodeGraph(options).getDiagnosticsForFile(input);
}

export async function checkRustToolchain(options: ToolchainCheckOptions = {}): Promise<{ cargo: string; rustc: string }> {
  const env = buildToolchainEnv(options.env);
  const [cargo, rustc] = await Promise.all([runVersion('cargo', env), runVersion('rustc', env)]);
  const missing = [
    cargo ? undefined : 'cargo',
    rustc ? undefined : 'rustc',
  ].filter((value): value is string => Boolean(value));
  if (missing.length > 0) {
    throw new Error(
      `Rust toolchain required for @utk/code-graph native stack-graph sidecar. Missing ${missing.join(
        ', ',
      )}. Install rustup, then ensure cargo and rustc are on PATH.`,
    );
  }
  if (!cargo || !rustc) {
    throw new Error('Rust toolchain required for @utk/code-graph native stack-graph sidecar. Missing cargo, rustc.');
  }
  return { cargo, rustc };
}

export function listCodeGraphMcpTools(): Array<{
  name: CodeGraphMcpToolName;
  description: string;
  inputSchema: { type: 'object'; additionalProperties: boolean; properties: Record<string, unknown> };
}> {
  return CODE_GRAPH_MCP_TOOL_NAMES.map((name) => ({
    name,
    description: mcpDescription(name),
    inputSchema: { type: 'object', additionalProperties: true, properties: {} },
  }));
}

export async function handleCodeGraphMcpTool(
  graph: CodeGraph,
  name: CodeGraphMcpToolName | string,
  input: Record<string, unknown> = {},
): Promise<{ ok: true; result: unknown } | { ok: false; error: string }> {
  try {
    switch (name) {
      case 'code_graph_index_project':
        return { ok: true, result: await graph.indexProject() };
      case 'code_graph_get_symbols_overview':
        return { ok: true, result: await graph.getSymbolsOverview({ filePath: stringInput(input.filePath) }) };
      case 'code_graph_find_symbol':
        return { ok: true, result: await graph.findSymbol({ query: requiredString(input.query, 'query'), limit: numberInput(input.limit) }) };
      case 'code_graph_find_definition':
        return {
          ok: true,
          result: await graph.findDefinition({
            query: stringInput(input.query),
            filePath: stringInput(input.filePath),
            line: numberInput(input.line),
            column: numberInput(input.column),
          }),
        };
      case 'code_graph_find_references':
        return { ok: true, result: await graph.findReferences({ symbolId: stringInput(input.symbolId), query: stringInput(input.query) }) };
      case 'code_graph_find_implementations':
        return { ok: true, result: await graph.findImplementations({ symbolId: stringInput(input.symbolId), query: stringInput(input.query) }) };
      case 'code_graph_retrieve_context':
        return {
          ok: true,
          result: await graph.retrieveContext({
            query: requiredString(input.query, 'query'),
            budgetTokens: numberInput(input.budgetTokens),
            includeBodies: booleanInput(input.includeBodies),
          }),
        };
      case 'code_graph_replace_symbol_body':
        return {
          ok: true,
          result: await graph.replaceSymbolBody({
            symbolId: stringInput(input.symbolId),
            query: stringInput(input.query),
            newBody: requiredString(input.newBody, 'newBody'),
            apply: booleanInput(input.apply),
          }),
        };
      case 'code_graph_insert_before_symbol':
        return {
          ok: true,
          result: await graph.insertBeforeSymbol({
            symbolId: stringInput(input.symbolId),
            query: stringInput(input.query),
            text: requiredString(input.text, 'text'),
            apply: booleanInput(input.apply),
          }),
        };
      case 'code_graph_insert_after_symbol':
        return {
          ok: true,
          result: await graph.insertAfterSymbol({
            symbolId: stringInput(input.symbolId),
            query: stringInput(input.query),
            text: requiredString(input.text, 'text'),
            apply: booleanInput(input.apply),
          }),
        };
      case 'code_graph_safe_delete_symbol':
        return {
          ok: true,
          result: await graph.safeDeleteSymbol({
            symbolId: stringInput(input.symbolId),
            query: stringInput(input.query),
            apply: booleanInput(input.apply),
          }),
        };
      case 'code_graph_rename_symbol':
        return {
          ok: true,
          result: await graph.renameSymbol({
            symbolId: stringInput(input.symbolId),
            query: stringInput(input.query),
            newName: requiredString(input.newName, 'newName'),
            apply: booleanInput(input.apply),
          }),
        };
      case 'code_graph_get_diagnostics_for_file':
        return { ok: true, result: await graph.getDiagnosticsForFile({ filePath: requiredString(input.filePath, 'filePath') }) };
      default:
        return { ok: false, error: `Unknown code graph MCP tool: ${name}` };
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

class LocalCodeGraph implements CodeGraph {
  private readonly workspaceRoot: string;
  private readonly storageRoot: string;
  private readonly languages: CodeGraphLanguage[];
  private readonly ignoredGlobs: string[];
  private readonly maxContextTokens: number;
  private state: IndexState = { files: [], symbols: [], aliases: [], references: [], indexed: false };

  constructor(options: CodeGraphOptions) {
    this.workspaceRoot = path.resolve(options.workspaceRoot);
    this.storageRoot = path.resolve(options.storageRoot ?? path.join(this.workspaceRoot, '.utk', 'code-graph'));
    this.languages = options.languages ?? ['typescript', 'javascript'];
    this.ignoredGlobs = options.ignoredGlobs ?? [];
    this.maxContextTokens = options.maxContextTokens ?? 1200;
  }

  async indexProject(): Promise<IndexProjectResult> {
    await mkdir(this.storageRoot, { recursive: true });
    const filePaths = await discoverSourceFiles(this.workspaceRoot, this.languages, this.ignoredGlobs);
    const files = await Promise.all(filePaths.map((filePath) => this.readSource(filePath)));
    const symbols = files.flatMap((file) => collectSymbols(file));
    const aliases = files.flatMap((file) => collectAliases(file, symbols));
    const references = collectReferences(files, symbols, aliases);
    this.state = { files, symbols, aliases, references, indexed: true };
    await this.writeIndexArtifacts();
    return {
      fileCount: files.length,
      symbolCount: symbols.length,
      referenceCount: references.length,
      storageRoot: this.storageRoot,
      diagnostics: [],
    };
  }

  async getSymbolsOverview(input: { filePath?: string }): Promise<{ symbols: CodeGraphSymbol[] }> {
    await this.ensureIndexed();
    const symbols = this.state.symbols.filter((symbol) => !input.filePath || sameRelativePath(symbol.filePath, input.filePath));
    return { symbols: symbols.map(compactSymbol) };
  }

  async findSymbol(input: { query: string; kind?: CodeGraphSymbolKind; filePath?: string; limit?: number }): Promise<CodeGraphSymbol[]> {
    await this.ensureIndexed();
    const canonicalQuery = this.resolveAlias(input.query);
    const query = canonicalQuery.toLowerCase();
    return this.state.symbols
      .filter((symbol) => symbol.name.toLowerCase().includes(query))
      .filter((symbol) => !input.kind || symbol.kind === input.kind)
      .filter((symbol) => !input.filePath || sameRelativePath(symbol.filePath, input.filePath))
      .sort((left, right) => symbolScore(left, canonicalQuery) - symbolScore(right, canonicalQuery))
      .slice(0, input.limit ?? 20)
      .map(compactSymbol);
  }

  async findDefinition(input: { query?: string; filePath?: string; line?: number; column?: number }): Promise<{ symbol: CodeGraphSymbol } | undefined> {
    await this.ensureIndexed();
    const query = input.query ?? this.identifierAt(input.filePath, input.line, input.column);
    if (!query) return undefined;
    const [symbol] = await this.findSymbol({ query: this.resolveAlias(query), limit: 1 });
    return symbol ? { symbol } : undefined;
  }

  async findReferences(input: { symbolId?: string; query?: string }): Promise<{ symbol: CodeGraphSymbol; references: CodeGraphReference[] }> {
    await this.ensureIndexed();
    const symbol = this.resolveOne(input);
    const references = this.state.references
      .filter((reference) => reference.name === symbol.name)
      .map((reference) => ({ ...reference, symbolId: symbol.id }));
    return { symbol: compactSymbol(symbol), references };
  }

  async findImplementations(input: { symbolId?: string; query?: string }): Promise<{ symbol?: CodeGraphSymbol; symbols: CodeGraphSymbol[] }> {
    await this.ensureIndexed();
    const symbol = this.resolveOptional(input);
    const targetName = symbol?.name ?? input.query;
    if (!targetName) return { symbols: [] };
    const symbols = this.state.symbols.filter((candidate) => candidate.implements?.includes(targetName)).map(compactSymbol);
    return { symbol: symbol ? compactSymbol(symbol) : undefined, symbols };
  }

  async retrieveContext(input: { query: string; budgetTokens?: number; includeBodies?: boolean }): Promise<ContextPackResult> {
    await this.ensureIndexed();
    const budgetTokens = input.budgetTokens ?? this.maxContextTokens;
    const symbols = await this.findSymbol({ query: input.query, limit: 8 });
    const references = symbols.flatMap((symbol) =>
      this.state.references.filter((reference) => reference.name === symbol.name).slice(0, 8),
    );
    const raw = {
      query: input.query,
      symbols,
      references,
      generatedBy: '@utk/code-graph',
      mode: input.includeBodies ? 'metadata-plus-bodies' : 'compact-metadata',
    };
    const rawTokenEstimate = estimateTokens(JSON.stringify(raw));
    const compactText = this.compactContext(input.query, symbols, references, budgetTokens, Boolean(input.includeBodies));
    const visibleTokens = estimateTokens(compactText);
    const artifactId = `utk_${hashText(`${input.query}:${JSON.stringify(symbols)}`, 16)}`;
    const artifactRoot = safeJoin(this.storageRoot, 'context', artifactId);
    await mkdir(artifactRoot, { recursive: true });
    const rawJsonPath = safeJoin(artifactRoot, 'context.raw.json');
    const compactToonPath = safeJoin(artifactRoot, 'context.compact.toon');
    await atomicWriteFile(rawJsonPath, canonicalJson(raw));
    await atomicWriteFile(compactToonPath, `${compactText}\n`);
    return {
      query: input.query,
      compactText,
      visibleTokens,
      rawTokenEstimate,
      tokenRatio: Number((visibleTokens / Math.max(rawTokenEstimate, 1)).toFixed(3)),
      recoveryArtifacts: {
        artifactId,
        rawJsonPath,
        compactToonPath,
        compactResponse: buildCompactResponse(rawJsonPath, 'code_graph.context.v1', 0.98, 'toon', compactToonPath),
      },
      symbols,
    };
  }

  async replaceSymbolBody(input: { symbolId?: string; query?: string; newBody: string; apply?: boolean }): Promise<EditResult> {
    await this.ensureIndexed();
    const symbol = this.resolveOne(input);
    const patch = await this.patchFor(symbol, 'replace', symbol.range.startOffset, symbol.range.endOffset, input.newBody);
    return this.applyOrPreview([patch], input.apply, 'replace symbol body');
  }

  async insertBeforeSymbol(input: { symbolId?: string; query?: string; text: string; apply?: boolean }): Promise<EditResult> {
    await this.ensureIndexed();
    const symbol = this.resolveOne(input);
    const patch = await this.patchFor(symbol, 'insert_before', symbol.range.startOffset, symbol.range.startOffset, input.text);
    return this.applyOrPreview([patch], input.apply, 'insert before symbol');
  }

  async insertAfterSymbol(input: { symbolId?: string; query?: string; text: string; apply?: boolean }): Promise<EditResult> {
    await this.ensureIndexed();
    const symbol = this.resolveOne(input);
    const patch = await this.patchFor(symbol, 'insert_after', symbol.range.endOffset, symbol.range.endOffset, input.text);
    return this.applyOrPreview([patch], input.apply, 'insert after symbol');
  }

  async safeDeleteSymbol(input: { symbolId?: string; query?: string; apply?: boolean }): Promise<EditResult & { blocked: boolean; references: CodeGraphReference[] }> {
    await this.ensureIndexed();
    const symbol = this.resolveOne(input);
    const references = (await this.findReferences({ symbolId: symbol.id })).references;
    const nonDeclarationReferences = references.filter((reference) => reference.kind !== 'declaration');
    if (nonDeclarationReferences.length > 0) {
      return {
        applied: false,
        blocked: true,
        references,
        patches: [],
        message: 'safe delete blocked: symbol still has references',
      };
    }
    const patch = await this.patchFor(symbol, 'delete', symbol.range.startOffset, symbol.range.endOffset, '');
    const result = await this.applyOrPreview([patch], input.apply, 'delete symbol');
    return { ...result, blocked: false, references };
  }

  async renameSymbol(input: { symbolId?: string; query?: string; newName: string; apply?: boolean }): Promise<EditResult> {
    await this.ensureIndexed();
    const symbol = this.resolveOne(input);
    const references = (await this.findReferences({ symbolId: symbol.id })).references;
    const patches = await Promise.all(
      references.map((reference) =>
        this.patchForReference(reference, 'rename', reference.range.startOffset, reference.range.endOffset, input.newName),
      ),
    );
    return this.applyOrPreview(patches, input.apply, 'rename symbol');
  }

  async getDiagnosticsForFile(input: { filePath: string }): Promise<{ diagnostics: CodeGraphDiagnostic[] }> {
    const absolutePath = this.absolute(input.filePath);
    const program = ts.createProgram({
      rootNames: [absolutePath],
      options: {
        allowJs: true,
        checkJs: true,
        noEmit: true,
        skipLibCheck: true,
        strict: false,
        noLib: true,
        types: [],
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
      },
    });
    const diagnostics = ts
      .getPreEmitDiagnostics(program)
      .filter((diagnostic) => diagnostic.file?.fileName && sameAbsolutePath(diagnostic.file.fileName, absolutePath))
      .map((diagnostic) => diagnosticToCodeGraph(input.filePath, diagnostic));
    return { diagnostics };
  }

  private async readSource(filePath: string): Promise<SourceRecord> {
    const absolutePath = this.absolute(filePath);
    const content = await readFile(absolutePath, 'utf8');
    return {
      filePath,
      absolutePath,
      content,
      sourceFile: ts.createSourceFile(absolutePath, content, ts.ScriptTarget.Latest, true, scriptKindFor(filePath)),
    };
  }

  private async writeIndexArtifacts(): Promise<void> {
    const symbolsPath = safeJoin(this.storageRoot, 'symbols.jsonl');
    const statusPath = safeJoin(this.storageRoot, 'status.json');
    await atomicWriteFile(symbolsPath, this.state.symbols.map((symbol) => JSON.stringify(symbol)).join('\n'));
    await atomicWriteFile(
      statusPath,
      canonicalJson({
        fileCount: this.state.files.length,
        symbolCount: this.state.symbols.length,
        referenceCount: this.state.references.length,
      }),
    );
  }

  private async ensureIndexed(): Promise<void> {
    if (!this.state.indexed) {
      await this.indexProject();
    }
  }

  private resolveOne(input: { symbolId?: string; query?: string }): CodeGraphSymbol {
    const symbol = this.resolveOptional(input);
    if (!symbol) {
      throw new Error('Symbol not found');
    }
    const duplicateCount = input.query ? this.state.symbols.filter((candidate) => candidate.name === input.query).length : 1;
    if (!input.symbolId && duplicateCount > 1) {
      throw new Error(`Ambiguous symbol query: ${input.query}`);
    }
    return symbol;
  }

  private resolveOptional(input: { symbolId?: string; query?: string }): CodeGraphSymbol | undefined {
    if (input.symbolId) {
      return this.state.symbols.find((symbol) => symbol.id === input.symbolId);
    }
    if (input.query) {
      const canonicalQuery = this.resolveAlias(input.query);
      return [...this.state.symbols].sort((left, right) => symbolScore(left, canonicalQuery) - symbolScore(right, canonicalQuery))[0];
    }
    return undefined;
  }

  private resolveAlias(query: string): string {
    return this.state.aliases.find((alias) => alias.alias === query)?.target ?? query;
  }

  private identifierAt(filePath?: string, line?: number, column?: number): string | undefined {
    if (!filePath || line === undefined || column === undefined) return undefined;
    const source = this.state.files.find((file) => sameRelativePath(file.filePath, filePath));
    if (!source) return undefined;
    const offset = source.sourceFile.getPositionOfLineAndCharacter(Math.max(0, line - 1), Math.max(0, column - 1));
    const token = findIdentifierAt(source.sourceFile, offset);
    return token?.text;
  }

  private compactContext(
    query: string,
    symbols: CodeGraphSymbol[],
    references: CodeGraphReference[],
    budgetTokens: number,
    includeBodies: boolean,
  ): string {
    const lines = [
      'code_graph_context: v1',
      `query: ${query}`,
      'symbols:',
      ...symbols.map(
        (symbol) =>
          `- ${symbol.id} ${symbol.kind} ${symbol.name} ${symbol.filePath}:${symbol.range.startLine}-${symbol.range.endLine}`,
      ),
      'references:',
      ...references.map((reference) => `- ${reference.name} ${reference.filePath}:${reference.range.startLine}`),
    ];
    if (includeBodies) {
      lines.push('bodies: stored in raw artifact only');
    }
    const selected: string[] = [];
    for (const line of lines) {
      const next = [...selected, line].join('\n');
      if (estimateTokens(next) <= budgetTokens || selected.length < 4) {
        selected.push(line);
      }
    }
    return selected.join('\n');
  }

  private async patchFor(
    symbol: CodeGraphSymbol,
    operation: CodeGraphPatch['operation'],
    startOffset: number,
    endOffset: number,
    replacement: string,
  ): Promise<CodeGraphPatch> {
    return this.patchForReference({ ...symbolReference(symbol), filePath: symbol.filePath }, operation, startOffset, endOffset, replacement);
  }

  private async patchForReference(
    reference: Pick<CodeGraphReference, 'filePath'>,
    operation: CodeGraphPatch['operation'],
    startOffset: number,
    endOffset: number,
    replacement: string,
  ): Promise<CodeGraphPatch> {
    const content = await readFile(this.absolute(reference.filePath), 'utf8');
    return {
      filePath: reference.filePath,
      operation,
      startOffset,
      endOffset,
      replacement,
      beforeHash: hashText(content, 16),
    };
  }

  private async applyOrPreview(patches: CodeGraphPatch[], apply: boolean | undefined, message: string): Promise<EditResult> {
    if (!apply) {
      return { applied: false, patches, message: `${message} preview` };
    }
    await applyPatches(this.workspaceRoot, patches);
    await this.indexProject();
    return { applied: true, patches, message };
  }

  private absolute(filePath: string): string {
    return safeJoin(this.workspaceRoot, filePath);
  }
}

function collectSymbols(file: SourceRecord): CodeGraphSymbol[] {
  const symbols: CodeGraphSymbol[] = [];

  function visit(node: ts.Node, container?: string): void {
    if (ts.isFunctionDeclaration(node) && node.name) {
      symbols.push(symbolFromNode(file, node.name.text, 'function', node, node.name, container));
    } else if (ts.isClassDeclaration(node) && node.name) {
      const symbol = symbolFromNode(file, node.name.text, 'class', node, node.name, container);
      symbol.implements = heritageNames(node);
      symbols.push(symbol);
      ts.forEachChild(node, (child) => visit(child, node.name?.text));
      return;
    } else if (ts.isInterfaceDeclaration(node)) {
      symbols.push(symbolFromNode(file, node.name.text, 'interface', node, node.name, container));
    } else if (ts.isTypeAliasDeclaration(node)) {
      symbols.push(symbolFromNode(file, node.name.text, 'type', node, node.name, container));
    } else if (ts.isEnumDeclaration(node)) {
      symbols.push(symbolFromNode(file, node.name.text, 'enum', node, node.name, container));
    } else if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name)) {
      symbols.push(symbolFromNode(file, node.name.text, 'method', node, node.name, container));
    } else if (ts.isVariableStatement(node)) {
      const kind = variableKind(node);
      for (const declaration of node.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          symbols.push(symbolFromNode(file, declaration.name.text, kind, node, declaration.name, container));
        }
      }
    }
    ts.forEachChild(node, (child) => visit(child, container));
  }

  visit(file.sourceFile);
  return symbols;
}

function collectAliases(file: SourceRecord, symbols: CodeGraphSymbol[]): CodeGraphAlias[] {
  const aliases: CodeGraphAlias[] = [];
  const symbolFiles = new Set(symbols.map((symbol) => symbol.filePath));
  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && node.importClause?.name && ts.isStringLiteral(node.moduleSpecifier)) {
      const targetFile = resolveImportFile(file.filePath, node.moduleSpecifier.text, symbolFiles);
      const defaultSymbol = targetFile
        ? symbols.find((symbol) => symbol.filePath === targetFile && symbol.defaultExport)
        : undefined;
      if (defaultSymbol && node.importClause.name.text !== defaultSymbol.name) {
        aliases.push({ alias: node.importClause.name.text, target: defaultSymbol.name, filePath: file.filePath });
      }
    } else if (ts.isImportSpecifier(node)) {
      const target = node.propertyName?.text ?? node.name.text;
      if (node.name.text !== target) {
        aliases.push({ alias: node.name.text, target, filePath: file.filePath });
      }
    } else if (ts.isExportSpecifier(node)) {
      const target = node.propertyName?.text ?? node.name.text;
      if (node.name.text !== target) {
        aliases.push({ alias: node.name.text, target, filePath: file.filePath });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file.sourceFile);
  return aliases;
}

function collectReferences(files: SourceRecord[], symbols: CodeGraphSymbol[], aliases: CodeGraphAlias[]): CodeGraphReference[] {
  const symbolNames = new Set(symbols.map((symbol) => symbol.name));
  const aliasByName = new Map(aliases.map((alias) => [alias.alias, alias.target]));
  const references: CodeGraphReference[] = [];
  for (const file of files) {
    function visit(node: ts.Node): void {
      if (ts.isIdentifier(node)) {
        const targetName = aliasByName.get(node.text) ?? node.text;
        if (symbolNames.has(targetName)) {
        const matchingSymbol = bestSymbolForReference(symbols, targetName, file.filePath);
        if (matchingSymbol) {
          references.push({
            symbolId: matchingSymbol.id,
            name: targetName,
            filePath: file.filePath,
            range: rangeFor(file.sourceFile, node),
            kind: referenceKind(node, matchingSymbol),
          });
        }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(file.sourceFile);
  }
  return references;
}

function symbolFromNode(
  file: SourceRecord,
  name: string,
  kind: CodeGraphSymbolKind,
  node: ts.Node,
  nameNode: ts.Node,
  container?: string,
): CodeGraphSymbol {
  const range = rangeFor(file.sourceFile, node);
  const selectionRange = rangeFor(file.sourceFile, nameNode);
  return {
    id: `cg_${hashText(`${file.filePath}:${kind}:${container ?? ''}:${name}:${range.startLine}:${range.startColumn}`, 16)}`,
    name,
    kind,
    filePath: file.filePath,
    range,
    selectionRange,
    exported: isExported(node),
    defaultExport: isDefaultExport(node) || undefined,
    container,
    signature: signatureFor(file.content, range),
  };
}

function compactSymbol(symbol: CodeGraphSymbol): CodeGraphSymbol {
  return { ...symbol };
}

function rangeFor(sourceFile: ts.SourceFile, node: ts.Node): CodeGraphRange {
  const startOffset = node.getStart(sourceFile);
  const endOffset = node.getEnd();
  const start = sourceFile.getLineAndCharacterOfPosition(startOffset);
  const end = sourceFile.getLineAndCharacterOfPosition(endOffset);
  return {
    startLine: start.line + 1,
    startColumn: start.character + 1,
    endLine: end.line + 1,
    endColumn: end.character + 1,
    startOffset,
    endOffset,
  };
}

function signatureFor(content: string, range: CodeGraphRange): string {
  const firstLine = content.slice(range.startOffset, range.endOffset).split(/\r?\n/, 1)[0] ?? '';
  return firstLine.trim().slice(0, 180);
}

function isExported(node: ts.Node): boolean {
  return Boolean(ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword));
}

function isDefaultExport(node: ts.Node): boolean {
  return Boolean(ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword));
}

function resolveImportFile(importingFile: string, specifier: string, knownFiles: Set<string>): string | undefined {
  if (!specifier.startsWith('.')) return undefined;
  const base = normalizePath(path.posix.join(path.posix.dirname(importingFile), specifier));
  const candidates = [
    base,
    base.replace(/\.js$/, '.ts'),
    base.replace(/\.js$/, '.tsx'),
    base.replace(/\.jsx$/, '.tsx'),
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
    `${base}/index.js`,
    `${base}/index.jsx`,
  ];
  return candidates.find((candidate) => knownFiles.has(candidate));
}

function variableKind(node: ts.VariableStatement): 'const' | 'let' | 'var' {
  const flags = ts.getCombinedNodeFlags(node.declarationList);
  if ((flags & ts.NodeFlags.Const) !== 0) return 'const';
  if ((flags & ts.NodeFlags.Let) !== 0) return 'let';
  return 'var';
}

function heritageNames(node: ts.ClassDeclaration): string[] {
  return (
    node.heritageClauses?.flatMap((clause) =>
      clause.types.map((type) => {
        const text = type.expression.getText(node.getSourceFile());
        return text.split('.').at(-1) ?? text;
      }),
    ) ?? []
  );
}

function referenceKind(node: ts.Identifier, symbol: CodeGraphSymbol): CodeGraphReference['kind'] {
  const range = rangeFor(node.getSourceFile(), node);
  if (sameRelativePath(symbol.filePath, relativeFromSource(node.getSourceFile())) && range.startOffset === symbol.selectionRange.startOffset) {
    return 'declaration';
  }
  if (ts.isExportSpecifier(node.parent)) return 'export';
  if (ts.isBinaryExpression(node.parent) && node.parent.left === node) return 'write';
  return 'read';
}

function bestSymbolForReference(symbols: CodeGraphSymbol[], name: string, filePath: string): CodeGraphSymbol | undefined {
  return (
    symbols.find((symbol) => symbol.name === name && sameRelativePath(symbol.filePath, filePath)) ??
    symbols.find((symbol) => symbol.name === name && symbol.exported) ??
    symbols.find((symbol) => symbol.name === name)
  );
}

function symbolReference(symbol: CodeGraphSymbol): CodeGraphReference {
  return {
    symbolId: symbol.id,
    name: symbol.name,
    filePath: symbol.filePath,
    range: symbol.selectionRange,
    kind: 'declaration',
  };
}

function findIdentifierAt(sourceFile: ts.SourceFile, offset: number): ts.Identifier | undefined {
  let found: ts.Identifier | undefined;
  function visit(node: ts.Node): void {
    if (found) return;
    if (ts.isIdentifier(node) && node.getStart(sourceFile) <= offset && node.getEnd() >= offset) {
      found = node;
      return;
    }
    if (node.getStart(sourceFile) <= offset && node.getEnd() >= offset) {
      ts.forEachChild(node, visit);
    }
  }
  visit(sourceFile);
  return found;
}

async function discoverSourceFiles(root: string, languages: CodeGraphLanguage[], ignoredGlobs: string[]): Promise<string[]> {
  const files: string[] = [];
  async function walk(relativeDir: string): Promise<void> {
    const absoluteDir = safeJoin(root, relativeDir);
    let entries: Dirent[];
    try {
      entries = await readdir(absoluteDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const relativePath = normalizePath(path.join(relativeDir, entry.name));
      if (isIgnored(relativePath, ignoredGlobs)) continue;
      if (entry.isDirectory()) {
        await walk(relativePath);
      } else if (isSourceFile(relativePath, languages)) {
        files.push(relativePath);
      }
    }
  }
  await walk('');
  return files.sort();
}

function isIgnored(relativePath: string, ignoredGlobs: string[]): boolean {
  const parts = relativePath.split('/');
  if (parts.some((part) => ['.git', '.utk', 'node_modules', 'dist', 'coverage'].includes(part))) return true;
  return ignoredGlobs.some((glob) => relativePath.includes(glob.replaceAll('*', '')));
}

function isSourceFile(filePath: string, languages: CodeGraphLanguage[]): boolean {
  if (filePath.endsWith('.d.ts')) return false;
  const extension = path.extname(filePath);
  if (languages.includes('typescript') && ['.ts', '.tsx'].includes(extension)) return true;
  return languages.includes('javascript') && ['.js', '.jsx'].includes(extension);
}

function scriptKindFor(filePath: string): ts.ScriptKind {
  if (filePath.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (filePath.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (filePath.endsWith('.js')) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function symbolScore(symbol: CodeGraphSymbol, query: string): number {
  const exact = symbol.name === query ? 0 : 100;
  const exported = symbol.exported ? 0 : 5;
  const methodPenalty = symbol.kind === 'method' ? 10 : 0;
  return exact + exported + methodPenalty + symbol.filePath.length / 1000;
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function hashText(text: string, length = 10): string {
  return createHash('sha256').update(text).digest('hex').slice(0, length);
}

async function applyPatches(workspaceRoot: string, patches: CodeGraphPatch[]): Promise<void> {
  const grouped = new Map<string, CodeGraphPatch[]>();
  for (const patch of patches) {
    grouped.set(patch.filePath, [...(grouped.get(patch.filePath) ?? []), patch]);
  }
  for (const [filePath, filePatches] of grouped.entries()) {
    const absolutePath = safeJoin(workspaceRoot, filePath);
    const original = await readFile(absolutePath, 'utf8');
    if (hashText(original, 16) !== filePatches[0]?.beforeHash) {
      throw new Error(`Patch refused: file changed before apply (${filePath})`);
    }
    const updated = [...filePatches]
      .sort((left, right) => right.startOffset - left.startOffset)
      .reduce((content, patch) => `${content.slice(0, patch.startOffset)}${patch.replacement}${content.slice(patch.endOffset)}`, original);
    await writeFile(absolutePath, updated, 'utf8');
  }
}

function diagnosticToCodeGraph(filePath: string, diagnostic: ts.Diagnostic): CodeGraphDiagnostic {
  const sourceFile = diagnostic.file;
  const start = diagnostic.start ?? 0;
  const length = diagnostic.length ?? 0;
  const range = sourceFile
    ? rangeFromOffsets(sourceFile, start, start + length)
    : undefined;
  return {
    filePath,
    code: diagnostic.code,
    category: diagnosticCategory(diagnostic.category),
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
    range,
  };
}

function rangeFromOffsets(sourceFile: ts.SourceFile, startOffset: number, endOffset: number): CodeGraphRange {
  const start = sourceFile.getLineAndCharacterOfPosition(startOffset);
  const end = sourceFile.getLineAndCharacterOfPosition(endOffset);
  return {
    startLine: start.line + 1,
    startColumn: start.character + 1,
    endLine: end.line + 1,
    endColumn: end.character + 1,
    startOffset,
    endOffset,
  };
}

function diagnosticCategory(category: ts.DiagnosticCategory): CodeGraphDiagnostic['category'] {
  if (category === ts.DiagnosticCategory.Warning) return 'warning';
  if (category === ts.DiagnosticCategory.Suggestion) return 'suggestion';
  if (category === ts.DiagnosticCategory.Message) return 'message';
  return 'error';
}

function relativeFromSource(sourceFile: ts.SourceFile): string {
  return normalizePath(sourceFile.fileName);
}

function sameRelativePath(left: string, right: string): boolean {
  return normalizePath(left) === normalizePath(right);
}

function sameAbsolutePath(left: string, right: string): boolean {
  return path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase();
}

function normalizePath(filePath: string): string {
  return filePath.replaceAll(path.sep, '/');
}

function buildToolchainEnv(env?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const merged = { ...process.env, ...env };
  if (env && Object.prototype.hasOwnProperty.call(env, 'PATH') && env.PATH === '') {
    merged.PATH = '';
    merged.Path = '';
  }
  return merged;
}

function runVersion(binary: string, env: NodeJS.ProcessEnv): Promise<string | undefined> {
  return new Promise((resolve) => {
    const child = spawn(binary, ['--version'], { env, shell: false, windowsHide: true });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString('utf8');
    });
    child.on('error', () => resolve(undefined));
    child.on('exit', (code) => resolve(code === 0 ? output.trim() : undefined));
  });
}

function mcpDescription(name: CodeGraphMcpToolName): string {
  return `@utk/code-graph ${name.replace('code_graph_', '').replaceAll('_', ' ')}`;
}

function stringInput(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new Error(`Missing required string: ${field}`);
  return value;
}

function numberInput(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function booleanInput(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}
