import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { completeStructuredToolInvocation } from '@utk/core';

describe('structured tooling comparative coverage', () => {
  it('handles varied registered tool inputs with deterministic completions', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-structured-evals-'));
    const tools = [
      {
        toolId: 'tool.index.search',
        description: 'index search',
        parameters: [{ name: 'query', required: true, completions: ['alpha:open alpha:label'] }]
      },
      {
        toolId: 'tool.table.query',
        description: 'table query',
        parameters: [{ name: 'expr', required: true, completions: ['select id,title from rows where state = open'] }]
      },
      {
        toolId: 'tool.scan.markers',
        description: 'marker scanner',
        parameters: [{ name: 'pattern', required: true, completions: ['(?:TODO|FIXME):\\s+.+'] }]
      }
    ];

    const index = await completeStructuredToolInvocation({
      workspaceRoot,
      request: 'use index search with alpha:open alpha:label',
      tools
    });
    const table = await completeStructuredToolInvocation({
      workspaceRoot,
      request: 'use table query select id,title from rows where state = open',
      tools
    });
    const markers = await completeStructuredToolInvocation({
      workspaceRoot,
      request: 'use marker scanner pattern (?:TODO|FIXME)',
      tools
    });

    expect(index.invocation.toolId).toBe('tool.index.search');
    expect(index.invocation.args.query).toContain('alpha');
    expect(table.invocation.toolId).toBe('tool.table.query');
    expect(table.invocation.args.expr).toContain('select');
    expect(markers.invocation.toolId).toBe('tool.scan.markers');
    expect(markers.invocation.args.pattern).toContain('TODO');
  });
});
