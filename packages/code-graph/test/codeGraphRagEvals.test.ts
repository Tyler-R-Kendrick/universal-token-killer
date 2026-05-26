import { access, mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createCodeGraph } from '../src/index.js';
import { CODE_GRAPH_RAG_FIXTURES } from '../../evals/fixtures/codeGraphRagFixtures.js';
import { assertCodeGraphRag } from '../../evals/metrics/codeGraphRagMetrics.js';

async function createFixture(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'utk-code-graph-rag-'));
  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content, 'utf8');
  }
  return root;
}

describe('@utk/code-graph code-RAG eval fixtures', () => {
  it.each(CODE_GRAPH_RAG_FIXTURES)('$name meets recall and compactness targets', async (fixture) => {
    const workspaceRoot = await createFixture(fixture.files);
    const graph = createCodeGraph({ workspaceRoot, maxContextTokens: 80 });
    await graph.indexProject();

    const symbols = await graph.findSymbol({ query: fixture.query, limit: 5 });
    const context = await graph.retrieveContext({ query: fixture.query, budgetTokens: 80 });
    await expect(access(context.recoveryArtifacts.rawJsonPath)).resolves.toBeUndefined();
    await expect(access(context.recoveryArtifacts.compactToonPath)).resolves.toBeUndefined();

    const assertion = assertCodeGraphRag({
      fixture,
      rankedSymbols: symbols,
      compactText: context.compactText,
      rawArtifactExists: true,
      compactArtifactExists: true,
    });

    expect(assertion.failures, assertion.failures.join('\n')).toEqual([]);
    expect(assertion.metrics.recallAt5).toBe(1);
    expect(assertion.metrics.tokenRatioVsSerena).toBeLessThanOrEqual(0.6);
    expect(assertion.metrics.recoverability).toBe(1);
    expect(assertion.metrics.noRawLeakage).toBe(1);
  });
});
