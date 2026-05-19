import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { completeStructuredToolInvocation } from '@utk/core';

describe('structured tooling comparative coverage', () => {
  it('handles varied registered LLM tool grammars with deterministic completions', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-structured-evals-'));
    const tools = [
      {
        toolId: 'github.search.issues',
        description: 'lucene issue search',
        parameters: [{ name: 'query', grammar: 'lucene' as const, required: true, completions: ['is:issue is:open label:bug'] }]
      },
      {
        toolId: 'db.query',
        description: 'sql database query',
        parameters: [{ name: 'sql', grammar: 'sql' as const, required: true, completions: ['select id,title from issues where state = open'] }]
      },
      {
        toolId: 'code.regex.find',
        description: 'regex scanner',
        parameters: [{ name: 'pattern', grammar: 'regex' as const, required: true, completions: ['(?:TODO|FIXME):\\s+.+'] }]
      }
    ];

    const lucene = await completeStructuredToolInvocation({
      workspaceRoot,
      request: 'search issue index for open bugs',
      tools
    });
    const sql = await completeStructuredToolInvocation({
      workspaceRoot,
      request: 'run sql database query over issues',
      tools
    });
    const regex = await completeStructuredToolInvocation({
      workspaceRoot,
      request: 'scan with regex scanner for todo markers',
      tools
    });

    expect(lucene.invocation.toolId).toBe('github.search.issues');
    expect(lucene.invocation.args.query).toContain('is:issue');
    expect(sql.invocation.toolId).toBe('db.query');
    expect(sql.invocation.args.sql).toContain('select');
    expect(regex.invocation.toolId).toBe('code.regex.find');
    expect(regex.invocation.args.pattern).toContain('TODO');
  });
});
