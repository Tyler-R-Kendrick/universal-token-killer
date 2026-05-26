import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CODE_GRAPH_MCP_TOOL_NAMES,
  checkRustToolchain,
  createCodeGraph,
  handleCodeGraphMcpTool,
  listCodeGraphMcpTools,
} from '../src/index.js';

async function createFixture(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'utk-code-graph-'));
  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content, 'utf8');
  }
  return root;
}

function fixtureFiles(): Record<string, string> {
  return {
    'src/widget.ts': [
      'export interface Widget {',
      '  id: string;',
      '}',
      '',
      'export function makeWidget(id: string): Widget {',
      '  return { id };',
      '}',
      '',
      'export class StoredWidget implements Widget {',
      '  constructor(public id: string) {}',
      '}',
      '',
      'export class WidgetStore {',
      '  save(widget: Widget) {',
      '    return makeWidget(widget.id);',
      '  }',
      '}',
    ].join('\n'),
    'src/index.ts': "export { makeWidget, WidgetStore, StoredWidget } from './widget.js';\n",
    'test/widget.test.ts': [
      "import { makeWidget } from '../src/index.js';",
      '',
      "export const result = makeWidget('alpha');",
    ].join('\n'),
  };
}

describe('@utk/code-graph SDK', () => {
  it('indexes symbols, resolves definitions/references/implementations, and emits compact recoverable context', async () => {
    const workspaceRoot = await createFixture(fixtureFiles());
    const graph = createCodeGraph({ workspaceRoot, maxContextTokens: 80 });

    const indexResult = await graph.indexProject();
    expect(indexResult.fileCount).toBe(3);
    expect(indexResult.symbolCount).toBeGreaterThanOrEqual(5);
    expect(indexResult.storageRoot).toContain(path.join('.utk', 'code-graph'));

    const overview = await graph.getSymbolsOverview({ filePath: 'src/widget.ts' });
    expect(overview.symbols.map((symbol) => symbol.name)).toEqual(
      expect.arrayContaining(['Widget', 'makeWidget', 'StoredWidget', 'WidgetStore', 'save']),
    );

    const matches = await graph.findSymbol({ query: 'makeWidget' });
    expect(matches[0]).toMatchObject({ name: 'makeWidget', kind: 'function', filePath: 'src/widget.ts' });

    const definition = await graph.findDefinition({ query: 'makeWidget' });
    expect(definition?.symbol.filePath).toBe('src/widget.ts');

    const references = await graph.findReferences({ symbolId: matches[0].id });
    expect(references.references.map((reference) => reference.filePath)).toEqual(
      expect.arrayContaining(['src/widget.ts', 'src/index.ts', 'test/widget.test.ts']),
    );

    const implementations = await graph.findImplementations({ query: 'Widget' });
    expect(implementations.symbols.map((symbol) => symbol.name)).toContain('StoredWidget');

    const context = await graph.retrieveContext({ query: 'makeWidget', budgetTokens: 80 });
    expect(context.visibleTokens).toBeLessThanOrEqual(80);
    expect(context.compactText).toContain('makeWidget');
    expect(context.compactText).toContain('src/widget.ts');
    expect(context.compactText).not.toContain('return { id }');
    expect(context.recoveryArtifacts.rawJsonPath).toContain(path.join('.utk', 'code-graph', 'context'));
    await access(context.recoveryArtifacts.rawJsonPath);
    await access(context.recoveryArtifacts.compactToonPath);
  });

  it('returns patch previews and blocks unsafe deletes when references remain', async () => {
    const workspaceRoot = await createFixture(fixtureFiles());
    const graph = createCodeGraph({ workspaceRoot });
    await graph.indexProject();
    const [symbol] = await graph.findSymbol({ query: 'makeWidget' });

    const replacePreview = await graph.replaceSymbolBody({
      symbolId: symbol.id,
      newBody: 'export function makeWidget(id: string): Widget {\n  return { id: id.toUpperCase() };\n}',
    });
    expect(replacePreview.applied).toBe(false);
    expect(replacePreview.patches[0]).toMatchObject({ filePath: 'src/widget.ts', operation: 'replace' });

    const beforePreview = await graph.insertBeforeSymbol({ symbolId: symbol.id, text: '// before\n' });
    expect(beforePreview.patches[0]).toMatchObject({ operation: 'insert_before' });

    const afterPreview = await graph.insertAfterSymbol({ symbolId: symbol.id, text: '\n// after' });
    expect(afterPreview.patches[0]).toMatchObject({ operation: 'insert_after' });

    const deletePreview = await graph.safeDeleteSymbol({ symbolId: symbol.id });
    expect(deletePreview.blocked).toBe(true);
    expect(deletePreview.references.length).toBeGreaterThan(1);

    const renamePreview = await graph.renameSymbol({ symbolId: symbol.id, newName: 'buildWidget' });
    expect(renamePreview.applied).toBe(false);
    expect(renamePreview.patches.map((patch) => patch.filePath)).toEqual(
      expect.arrayContaining(['src/widget.ts', 'src/index.ts', 'test/widget.test.ts']),
    );
  });

  it('reports TypeScript diagnostics for a single file', async () => {
    const workspaceRoot = await createFixture({
      'src/broken.ts': 'const count: number = "oops";\n',
    });
    const graph = createCodeGraph({ workspaceRoot });

    const diagnostics = await graph.getDiagnosticsForFile({ filePath: 'src/broken.ts' });
    expect(diagnostics.diagnostics[0]).toMatchObject({ code: 2322, filePath: 'src/broken.ts' });
    expect(diagnostics.diagnostics[0].message).toContain('string');
  });

  it('exposes Serena-parity MCP tools and dispatches compact SDK calls', async () => {
    const workspaceRoot = await createFixture(fixtureFiles());
    const graph = createCodeGraph({ workspaceRoot });
    await graph.indexProject();

    expect(CODE_GRAPH_MCP_TOOL_NAMES).toEqual([
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
    ]);
    expect(listCodeGraphMcpTools().map((tool) => tool.name)).toEqual(CODE_GRAPH_MCP_TOOL_NAMES);

    const result = await handleCodeGraphMcpTool(graph, 'code_graph_find_symbol', { query: 'makeWidget' });
    expect(result).toMatchObject({ ok: true });
    expect(JSON.stringify(result)).not.toContain('return { id }');
  });

  it('fails clearly when Rust toolchain is missing for native stack-graph builds', async () => {
    await expect(checkRustToolchain({ env: { PATH: '' } })).rejects.toThrow(
      /Rust toolchain required.*cargo.*rustc/i,
    );
  });
});
