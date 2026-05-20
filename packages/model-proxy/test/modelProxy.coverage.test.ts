import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdtemp, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  applyModelProxyPolicy,
  createDefaultCompressorRegistry,
  createModelProxyServer,
  createPolicyMetricsStore,
  expandContextArtifact,
  expandEditRangesInRequest,
  minimizeToolSchemas,
  normalizeOpenAiRequest,
  proxyOpenAiRequest,
  routeContentForProxy,
  shouldCompactContent
} from '../src/index.js';
import { safeJoin } from '../src/utils.js';

const openedServers: Array<{ close: () => Promise<void> }> = [];

afterEach(async () => {
  while (openedServers.length > 0) {
    await openedServers.pop()?.close();
  }
});

describe('model proxy coverage paths', () => {
  it('covers route classifiers and schema minimization fallbacks', () => {
    expect(routeContentForProxy('{"b":2,"a":1}', '').serializerId).toBe('compressed-json');
    expect(routeContentForProxy('```ts\nconst x = 1;\n```', '').routeReason).toBe('protected-spans');
    expect(routeContentForProxy('<type>file</type>\noldString', '').routeReason).toBe('file-read-envelope');
    expect(routeContentForProxy('INFO ready', '').routeReason).toBe('tool-output');
    expect(routeContentForProxy('lots of context', 'budget headroom').routeReason).toBe('context-pressure');
    expect(routeContentForProxy('plain words', '').compactText).toContain('plain words');
    expect(routeContentForProxy(Array.from({ length: 20 }, (_, index) => `error: e${index}`).join('\n'), '').protectedPreview.split('\n')).toHaveLength(12);
    expect(shouldCompactContent('short', 9999)).toBe(false);
    expect(shouldCompactContent('[1,2,3]', 9999)).toBe(true);

    const minimized = minimizeToolSchemas([
      { type: 'function', function: { name: 'unknown_tool', description: 'This tool has a long sentence. More text.', parameters: { type: 'object', properties: { q: { type: 'string', description: 'query' } } } } },
      { type: 'function', function: { name: 'empty_description', description: '', parameters: null } },
      { type: 'function', other: true },
      'ignored'
    ], false);
    expect(minimized.tools[0].function.description).toBe('This tool has a long sentence.');
    expect(minimized.tools[0].function.parameters.properties.q.description).toBeUndefined();
    expect(minimized.tools[1].function.description).toBe('Use tool.');
    expect(minimized.tools[2]).toEqual({ type: 'function', other: true });
    expect(minimizeToolSchemas('bad', true).tools[0].function.name).toBe('utk_expand_context');
  });

  it('covers compressors, responses input compaction, and no-op chat branches', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-model-proxy-coverage-'));
    const fake = await createDefaultCompressorRegistry({ fake: true }).defaultText.compress('one two three four', { rate: 0.5 });
    const fakeDefaultRate = await createDefaultCompressorRegistry({ fake: true }).defaultText.compress('one two three');
    const passthrough = await createDefaultCompressorRegistry().defaultText.compress('one two');
    expect(fake.text).toBe('one two');
    expect(fakeDefaultRate.applied).toBe(true);
    expect(passthrough.applied).toBe(false);

    const responses = await applyModelProxyPolicy(
      {
        model: 'gpt-test',
        input: [
          { type: 'function_call_output', call_id: 'call_1', output: '{"items":[1,2,3]}' },
          { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'budget?' }] },
          { type: 'function_call_output', call_id: 'call_2', output: 7 }
        ]
      },
      { route: '/v1/responses', workspaceRoot, metricsStore: createPolicyMetricsStore(workspaceRoot) }
    );
    expect(responses.request.input[0].output).toContain('utk-ref:');
    expect(responses.metrics.routeReasons).toContain('structured-json');

    const chat = await applyModelProxyPolicy({ model: 'gpt-test', messages: [{ role: 'assistant', content: null }, { role: 'tool', content: 'tiny' }] }, { route: '/v1/chat/completions', workspaceRoot });
    expect(chat.artifacts).toEqual([]);
    const emptyResponses = await applyModelProxyPolicy({ model: 'gpt-test', input: 'bad' }, { route: '/v1/responses', workspaceRoot });
    expect(emptyResponses.artifacts).toEqual([]);
    const injectedTools = await applyModelProxyPolicy({ model: 'gpt-test', messages: [] }, { route: '/v1/chat/completions', workspaceRoot });
    expect(injectedTools.request.tools[0].function.name).toBe('utk_expand_context');
    expect((await createPolicyMetricsStore(workspaceRoot).snapshot()).lastArtifactId).toBeUndefined();
  });

  it('covers request validation and edit-range fail-open branches', async () => {
    expect(() => normalizeOpenAiRequest('/v1/chat/completions', null)).toThrow('OpenAI request body');
    expect(() => normalizeOpenAiRequest('/v1/embeddings', {})).toThrow('Unsupported OpenAI route');
    expect(normalizeOpenAiRequest('/v1/chat/completions', { messages: 'bad' }).messages).toEqual([]);
    expect(normalizeOpenAiRequest('/v1/responses', { input: 'bad' }).items).toEqual([]);

    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-model-proxy-edit-cover-'));
    await writeFile(path.join(workspaceRoot, 'a.ts'), 'one\ntwo\n', 'utf8');
    const disabled = await expandEditRangesInRequest({ messages: [] }, { workspaceRoot, enabled: false });
    expect(disabled.expansions).toEqual([]);
    const invalid = await expandEditRangesInRequest({
      messages: [
        { tool_calls: [
          { function: { name: 'read', arguments: '{}' } },
          { function: { name: 'edit', arguments: '{' } },
          { function: { name: 'edit', arguments: JSON.stringify({ path: 'a.ts', oldString: '3-2' }) } },
          { function: { name: 'edit', arguments: JSON.stringify({ path: 'a.ts', oldString: '9' }) } },
          { function: { name: 'edit', arguments: JSON.stringify({ path: 'a.ts', oldString: '1' }) } },
          { function: { name: 'edit', arguments: JSON.stringify({ oldString: '1' }) } }
        ] }
      ]
    }, { workspaceRoot, enabled: true });
    expect(invalid.expansions).toHaveLength(1);
  });

  it('covers recovery validation and path safety', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-model-proxy-safe-'));
    await expect(expandContextArtifact(workspaceRoot, 'bad')).rejects.toThrow('Invalid context artifact id');
    expect(() => safeJoin(workspaceRoot, '..', 'escape')).toThrow('Path traversal blocked');
    expect(safeJoin(workspaceRoot, 'new', 'file.txt')).toContain('new');

    try {
      await symlink('C:\\', path.join(workspaceRoot, 'link'));
      expect(() => safeJoin(workspaceRoot, 'link', 'x')).toThrow('Symlink traversal blocked');
    } catch (error) {
      expect((error as NodeJS.ErrnoException).code).toBe('EPERM');
    }
  });

  it('covers HTTP errors, health, expansion validation, and proxy expansion loop', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-model-proxy-http-cover-'));
    let seenFollowUp = false;
    const upstream = await startUpstream(async (req, res, body) => {
      if (req.url === '/v1/chat/completions' || req.url === '/chat/completions') {
        seenFollowUp = JSON.parse(body).messages.some((message: any) => message.name === 'utk_expand_context');
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, seenFollowUp }));
        return;
      }
      if (req.url === '/v1/models') {
        res.writeHead(204);
        res.end();
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ object: 'list', data: [] }));
    });
    openedServers.push(upstream);

    const policy = await applyModelProxyPolicy({ model: 'gpt-test', messages: [{ role: 'tool', content: '{"x":1}' }] }, { route: '/v1/chat/completions', workspaceRoot });
    const artifactId = policy.artifacts[0].id;

    const expandUpstream = await startUpstream(async (_req, res, body) => {
      seenFollowUp = body ? JSON.parse(body).messages?.some((message: any) => message.name === 'utk_expand_context') : false;
      if (!seenFollowUp) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ choices: [{ message: { tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'utk_expand_context', arguments: JSON.stringify({ id: artifactId }) } }] } }] }));
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
    openedServers.push(expandUpstream);
    const loop = await proxyOpenAiRequest('/v1/chat/completions', { model: 'gpt-test', messages: [] }, { workspaceRoot, upstreamBaseUrl: expandUpstream.url });
    expect(await loop.json()).toEqual({ ok: true });
    const invalidLoop = await proxyOpenAiRequest('/v1/chat/completions', { model: 'gpt-test', messages: [] }, { workspaceRoot, upstreamBaseUrl: upstream.url });
    expect(await invalidLoop.json()).toEqual({ ok: true, seenFollowUp: false });

    const proxy = await createModelProxyServer({ workspaceRoot, upstreamProvider: 'openai', upstreamBaseUrl: upstream.url, port: 0 });
    openedServers.push(proxy);
    expect(await (await fetch(`${proxy.url}/healthz`)).json()).toMatchObject({ ok: true });
    expect((await fetch(`${proxy.url}/missing`)).status).toBe(404);
    expect((await fetch(`${proxy.url}/v1/utk/expand_context`, { method: 'POST', body: '{}' })).status).toBe(400);
    expect((await fetch(`${proxy.url}/v1/chat/completions`, { method: 'POST', body: '{' })).status).toBe(500);
    expect((await fetch(`${proxy.url}/v1/models`)).status).toBe(204);
  });
});

async function startUpstream(handler: (req: IncomingMessage, res: ServerResponse, body: string) => Promise<void> | void): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => void handler(req, res, Buffer.concat(chunks).toString('utf8')));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('unexpected address');
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  };
}
