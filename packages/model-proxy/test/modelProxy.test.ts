import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  applyModelProxyPolicy,
  createDefaultCompressorRegistry,
  createModelProxyServer,
  expandContextArtifact,
  expandEditRangesInRequest,
  normalizeOpenAiRequest,
  proxyOpenAiRequest
} from '../src/index.js';
import { routeContentForProxy } from '../src/contentRouter.js';

const openedServers: Array<{ close: () => Promise<void> }> = [];

afterEach(async () => {
  while (openedServers.length > 0) {
    await openedServers.pop()?.close();
  }
});

describe('OpenAI-compatible model proxy', () => {
  it('normalizes chat and responses requests without dropping roles, content parts, tool calls, or metadata', () => {
    const chat = normalizeOpenAiRequest('/v1/chat/completions', {
      model: 'gpt-test',
      metadata: { trace: 'abc' },
      messages: [
        { role: 'system', content: 'system text' },
        { role: 'user', content: [{ type: 'text', text: 'hello' }] },
        {
          role: 'assistant',
          content: null,
          tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'lookup', arguments: '{"q":"x"}' } }]
        }
      ]
    });

    expect(chat.kind).toBe('chat');
    expect(chat.messages.map((message) => message.role)).toEqual(['system', 'user', 'assistant']);
    expect(chat.body.metadata).toEqual({ trace: 'abc' });
    expect(chat.messages[1]?.content).toEqual([{ type: 'text', text: 'hello' }]);
    expect(chat.messages[2]?.tool_calls?.[0]?.function.name).toBe('lookup');

    const responses = normalizeOpenAiRequest('/v1/responses', {
      model: 'gpt-test',
      input: [
        { role: 'user', content: [{ type: 'input_text', text: 'hi' }] },
        { type: 'function_call_output', call_id: 'call_1', output: 'tool output' }
      ],
      metadata: { trace: 'def' }
    });

    expect(responses.kind).toBe('responses');
    expect(responses.body.metadata).toEqual({ trace: 'def' });
    expect(responses.items).toHaveLength(2);
  });

  it('compacts tool context, minimizes tool schemas, injects recovery, and preserves protected spans in artifacts', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-model-proxy-policy-'));
    const rawToolOutput = [
      'file: C:/repo/src/app.ts',
      'command: npm test -- --runInBand',
      '```ts',
      'export const exactName = "must-stay";',
      '```',
      ...Array.from({ length: 30 }, (_, index) => `NOISY_STACK_LINE_${index}: detail detail detail`)
    ].join('\n');

    const result = await applyModelProxyPolicy(
      {
        model: 'gpt-test',
        stream: false,
        messages: [
          { role: 'user', content: 'Why did tests fail?' },
          { role: 'tool', tool_call_id: 'call_1', name: 'powershell', content: rawToolOutput }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'run_shell',
              description: 'Run a shell command inside the current workspace and return stdout and stderr with detailed execution metadata.',
              parameters: {
                type: 'object',
                required: ['command'],
                properties: {
                  command: { type: 'string', description: 'The command to execute exactly as typed by the assistant.' }
                }
              }
            }
          }
        ]
      },
      {
        route: '/v1/chat/completions',
        workspaceRoot,
        compressorRegistry: createDefaultCompressorRegistry({ fake: true })
      }
    );

    const compactToolMessage = result.request.messages.find((message) => message.role === 'tool');
    expect(compactToolMessage?.content).toContain('utk-ref:');
    expect(compactToolMessage?.content).not.toContain('NOISY_STACK_LINE_29');
    expect(compactToolMessage?.content).toContain('command: npm test -- --runInBand');
    expect(compactToolMessage?.content).toContain('exactName');
    expect(result.request.tools.map((tool) => tool.function?.name)).toContain('utk_expand_context');
    expect(result.request.tools[0]?.function?.description).toBe('Run shell command.');
    expect(result.metrics.rawTokens).toBeGreaterThan(result.metrics.compactTokens);
    expect(result.metrics.routeReasons).toContain('tool-output');

    const artifact = result.artifacts[0];
    expect(artifact?.id).toMatch(/^utk_/);
    const expanded = await expandContextArtifact(workspaceRoot, artifact!.id);
    expect(expanded.content).toBe(rawToolOutput);
    expect(await readFile(path.join(workspaceRoot, '.utk', 'context-ir', 'model-proxy.jsonl'), 'utf8')).toContain('"routeReason":"tool-output"');
  });

  it('optimizes system/developer prompts and response instructions while leaving user messages unchanged', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-model-proxy-prompts-'));
    const systemPrompt = [
      'System priority: system > developer > user.',
      'Security warning: never expose secrets.',
      'Use tool detok exactly when bulky artifacts appear.',
      'Repeat UTK guidance. Repeat UTK guidance. Repeat UTK guidance.'
    ].join('\n');
    const userPrompt = 'Repeat UTK guidance. Repeat UTK guidance. User text must stay byte-identical.';

    const chat = await applyModelProxyPolicy(
      {
        model: 'gpt-test',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'developer', content: `Developer instruction: preserve .utk/model-proxy/prompt-artifacts refs. ${'Use UTK prompt optimizer for repeated high-cost surfaces. '.repeat(20)}` },
          { role: 'user', content: userPrompt }
        ]
      },
      { route: '/v1/chat/completions', workspaceRoot }
    );

    expect(chat.request.messages[0].content).toContain('[utk-prompt-ref:');
    expect(chat.request.messages[0].content).toContain('Security warning: never expose secrets.');
    expect(chat.request.messages[0].content).toContain('system > developer > user');
    expect(chat.request.messages[1].content).toContain('[utk-prompt-ref:');
    expect(chat.request.messages[2].content).toBe(userPrompt);
    expect(chat.metrics.promptTokensBefore).toBeGreaterThan(chat.metrics.promptTokensAfter);
    expect(chat.promptArtifacts).toHaveLength(2);
    await expect(readFile(chat.promptArtifacts[0].path, 'utf8')).resolves.toBe(systemPrompt);

    const responses = await applyModelProxyPolicy(
      {
        model: 'gpt-test',
        instructions: systemPrompt,
        input: [{ role: 'system', content: [{ type: 'input_text', text: systemPrompt }] }, { role: 'user', content: [{ type: 'input_text', text: userPrompt }] }]
      },
      { route: '/v1/responses', workspaceRoot }
    );

    expect(responses.request.instructions).toContain('[utk-prompt-ref:');
    expect(responses.request.input[0].content[0].text).toContain('[utk-prompt-ref:');
    expect(responses.request.input[1].content[0].text).toBe(userPrompt);
  });

  it('expands OpenSlimEdit-style line ranges only inside the workspace', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-model-proxy-edit-'));
    const file = path.join(workspaceRoot, 'src.ts');
    await writeFile(file, 'one\r\ntwo\r\nthree\r\nfour\r\n', 'utf8');

    const expanded = await expandEditRangesInRequest(
      {
        messages: [
          {
            role: 'assistant',
            tool_calls: [
              { id: 'call_1', type: 'function', function: { name: 'edit', arguments: JSON.stringify({ path: file, oldString: '2-3', newString: 'TWO\nTHREE' }) } },
              { id: 'call_2', type: 'function', function: { name: 'edit', arguments: JSON.stringify({ path: '..\\escape.ts', oldString: '1', newString: 'bad' }) } }
            ]
          }
        ]
      },
      { workspaceRoot, enabled: true }
    );

    const calls = expanded.messages[0].tool_calls;
    const firstArgs = JSON.parse(calls[0].function.arguments);
    const secondArgs = JSON.parse(calls[1].function.arguments);
    expect(firstArgs.oldString).toBe('two\r\nthree');
    expect(secondArgs.oldString).toBe('1');
    expect(expanded.expansions).toEqual([{ path: file, range: '2-3', lineStart: 2, lineEnd: 3 }]);
  });

  it('forwards chat, responses, models, expansion, and streaming through the HTTP server', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-model-proxy-http-'));
    const upstreamBodies: unknown[] = [];
    const upstream = await startUpstream(async (req, res, body) => {
      upstreamBodies.push(body ? JSON.parse(body) : undefined);
      if (req.url === '/v1/models') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ object: 'list', data: [{ id: 'gpt-test', object: 'model' }] }));
        return;
      }
      if (req.url === '/v1/chat/completions' && JSON.parse(body).stream) {
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        res.write('data: {"choices":[{"delta":{"content":"hi"}}]}\n\n');
        res.end('data: [DONE]\n\n');
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id: 'cmpl_1', object: 'chat.completion', choices: [{ message: { role: 'assistant', content: 'ok' } }] }));
    });
    openedServers.push(upstream);

    const proxy = await createModelProxyServer({
      workspaceRoot,
      upstreamProvider: 'openai',
      upstreamBaseUrl: upstream.url,
      upstreamApiKey: 'secret',
      port: 0,
      compressorRegistry: createDefaultCompressorRegistry({ fake: true })
    });
    openedServers.push(proxy);

    const chat = await fetchJson(`${proxy.url}/v1/chat/completions`, {
      model: 'gpt-test',
      messages: [{ role: 'tool', name: 'search', content: 'alpha beta gamma '.repeat(200) }]
    });
    expect(chat.id).toBe('cmpl_1');
    expect(JSON.stringify(upstreamBodies[0])).toContain('utk-ref:');

    const artifacts = await proxy.metricsStore.snapshot();
    const expanded = await fetchJson(`${proxy.url}/v1/utk/expand_context`, { id: artifacts.lastArtifactId });
    expect(expanded.content).toContain('alpha beta gamma');

    const models = await fetch(`${proxy.url}/v1/models`);
    expect(await models.json()).toMatchObject({ object: 'list' });

    const stream = await fetch(`${proxy.url}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-test', stream: true, messages: [{ role: 'user', content: 'hi' }] })
    });
    expect(await stream.text()).toContain('data: [DONE]');

    const metrics = await fetch(`${proxy.url}/metrics`);
    expect(await metrics.json()).toMatchObject({ requests: 4, streams: 1 });
  });

  it('filters irrelevant tools, indexes artifacts, expands range/query snippets, and reports expanded metrics', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-model-proxy-gap-'));
    const upstreamBodies: any[] = [];
    const upstream = await startUpstream(async (_req, res, body) => {
      upstreamBodies.push(JSON.parse(body));
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id: 'cmpl_tools', choices: [{ message: { role: 'assistant', content: 'ok' } }] }));
    });
    openedServers.push(upstream);

    const proxy = await createModelProxyServer({ workspaceRoot, upstreamBaseUrl: upstream.url, upstreamApiKey: 'secret', port: 0 });
    openedServers.push(proxy);

    const rawOutput = ['alpha', 'beta important', 'gamma', 'beta second', ...Array.from({ length: 600 }, (_, index) => `noise ${index} repeated repeated repeated repeated`)].join('\n');
    await fetchJson(`${proxy.url}/v1/chat/completions`, {
      model: 'gpt-test',
      messages: [
        { role: 'user', content: 'Read file and inspect tests' },
        { role: 'tool', name: 'read_file', content: rawOutput }
      ],
      tools: [
        tool('read_file', 'Read file content.'),
        tool('send_email', 'Send outbound email.'),
        tool('utk_expand_context', 'Recover full context.')
      ]
    });

    expect(upstreamBodies[0].tools.map((item: any) => item.function.name)).toEqual(['read_file', 'utk_expand_context']);
    const metrics = await (await fetch(`${proxy.url}/metrics`)).json();
    expect(metrics.toolDiscoveryTokensSaved).toBeGreaterThan(0);
    expect(metrics.routeReasons).toContain('tool-output');
    expect(metrics.routeReasons).toContain('tool-discovery');

    const expandedRange = await fetchJson(`${proxy.url}/v1/utk/expand_context`, { id: metrics.lastArtifactId, range: '2-4' });
    expect(expandedRange.content).toBe('beta important\ngamma\nbeta second');
    const expandedQuery = await fetchJson(`${proxy.url}/v1/utk/expand_context`, { id: metrics.lastArtifactId, query: 'beta' });
    expect(expandedQuery.content).toBe('beta important\nbeta second');
    await expect(readFile(path.join(workspaceRoot, '.utk', 'model-proxy', 'index.jsonl'), 'utf8')).resolves.toContain(metrics.lastArtifactId);
  });

  it('injects recoverable history summary blocks and exposes proof plus handle recovery endpoints', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-model-proxy-context-gateway-'));
    const upstreamBodies: any[] = [];
    const upstream = await startUpstream(async (_req, res, body) => {
      upstreamBodies.push(JSON.parse(body));
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id: 'cmpl_gateway', choices: [{ message: { role: 'assistant', content: 'ok' } }] }));
    });
    openedServers.push(upstream);
    const proxy = await createModelProxyServer({ workspaceRoot, upstreamBaseUrl: upstream.url, upstreamApiKey: 'secret', port: 0 });
    openedServers.push(proxy);

    await fetchJson(`${proxy.url}/v1/chat/completions`, {
      model: 'gpt-test',
      max_context_tokens: 5000,
      messages: [
        { role: 'system', content: 'System priority: system > developer > user.' },
        { role: 'user', content: 'Summarize older tool history.' },
        { role: 'tool', name: 'rg', content: 'src/app.ts:10: exact error TS2322\n'.repeat(500) }
      ]
    });

    const blockMessage = upstreamBodies[0].messages.find((message: any) => typeof message.content === 'string' && message.content.includes('[utk-block:'));
    expect(blockMessage?.content).toContain('history-summary');
    const metrics = await (await fetch(`${proxy.url}/metrics`)).json();
    expect(metrics.routeReasons).toContain('session-block');
    expect(metrics.sessionBlocks).toBeGreaterThan(0);

    const handle = { artifactId: metrics.lastArtifactId, range: '1-1' };
    const byHandle = await fetchJson(`${proxy.url}/v1/utk/expand_context`, { handle });
    expect(byHandle.content).toContain('exact error TS2322');

    const proof = await fetchJson(`${proxy.url}/v1/utk/proof`, {
      artifactId: metrics.lastArtifactId,
      requiredFacts: ['TS2322']
    });
    expect(proof.ok).toBe(true);
    expect(proof.checks).toEqual(expect.arrayContaining([{ name: 'recovery', passed: true }]));
  });

  it('performs one non-streaming recovery retry when upstream requests utk_expand_context', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-model-proxy-retry-'));
    const upstreamBodies: any[] = [];
    const upstream = await startUpstream(async (_req, res, body) => {
      const parsed = JSON.parse(body);
      upstreamBodies.push(parsed);
      res.writeHead(200, { 'content-type': 'application/json' });
      if (upstreamBodies.length === 1) {
        const content = parsed.messages.find((message: any) => message.role === 'tool').content;
        const id = /\[utk-ref:(utk_[a-f0-9]{16})\]/.exec(content)?.[1];
        res.end(JSON.stringify({
          choices: [{
            message: {
              role: 'assistant',
              tool_calls: [{ id: 'call_expand', type: 'function', function: { name: 'utk_expand_context', arguments: JSON.stringify({ id, range: '1-1' }) } }]
            }
          }]
        }));
        return;
      }
      res.end(JSON.stringify({ id: 'cmpl_retry', choices: [{ message: { role: 'assistant', content: 'done' } }] }));
    });
    openedServers.push(upstream);

    const response = await proxyOpenAiRequest(
      '/v1/chat/completions',
      { model: 'gpt-test', messages: [{ role: 'tool', name: 'search', content: 'needle first line\nnoise '.repeat(200) }] },
      { workspaceRoot, upstreamBaseUrl: upstream.url, upstreamApiKey: 'key' }
    );

    expect(await response.json()).toMatchObject({ id: 'cmpl_retry' });
    expect(upstreamBodies).toHaveLength(2);
    expect(upstreamBodies[1].messages.at(-1)).toMatchObject({
      role: 'tool',
      tool_call_id: 'call_expand',
      name: 'utk_expand_context',
      content: expect.stringContaining('needle first line')
    });
  });

  it('uses deferred tool search catalog and retries one non-streaming utk_find_tool call', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-model-proxy-find-tool-'));
    await mkdir(path.join(workspaceRoot, '.utk'), { recursive: true });
    await writeFile(
      path.join(workspaceRoot, '.utk', 'config.toml'),
      [
        '[serialization]',
        'default = "toon"',
        '',
        '[model_proxy]',
        'tool_discovery_mode = "deferred-search"',
        'deferred_tool_search_enabled = true',
        ''
      ].join('\n'),
      'utf8'
    );
    const upstreamBodies: any[] = [];
    const upstream = await startUpstream(async (_req, res, body) => {
      const parsed = JSON.parse(body);
      upstreamBodies.push(parsed);
      res.writeHead(200, { 'content-type': 'application/json' });
      if (upstreamBodies.length === 1) {
        res.end(JSON.stringify({
          choices: [{
            message: {
              role: 'assistant',
              tool_calls: [{ id: 'call_find', type: 'function', function: { name: 'utk_find_tool', arguments: JSON.stringify({ query: 'vitest tests' }) } }]
            }
          }]
        }));
        return;
      }
      res.end(JSON.stringify({ id: 'cmpl_find_tool', choices: [{ message: { role: 'assistant', content: 'done' } }] }));
    });
    openedServers.push(upstream);

    const response = await proxyOpenAiRequest(
      '/v1/chat/completions',
      {
        model: 'gpt-test',
        messages: [{ role: 'user', content: 'Run the vitest tests.' }],
        tools: [
          tool('run_tests', 'Run vitest tests and return diagnostics.'),
          tool('send_email', 'Send outbound mail.')
        ]
      },
      { workspaceRoot, upstreamBaseUrl: upstream.url, upstreamApiKey: 'key' }
    );

    expect(await response.json()).toMatchObject({ id: 'cmpl_find_tool' });
    expect(upstreamBodies).toHaveLength(2);
    expect(upstreamBodies[0].tools.map((item: any) => item.function.name)).toEqual(['utk_expand_context', 'utk_find_tool']);
    expect(upstreamBodies[1].messages.at(-1)).toMatchObject({
      role: 'tool',
      tool_call_id: 'call_find',
      name: 'utk_find_tool',
      content: expect.stringContaining('run_tests')
    });
    expect(upstreamBodies[1].messages.at(-1).content).not.toContain('send_email');
  });

  it('replaces old compacted history spans instead of duplicating them when pressure trips', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-model-proxy-replace-history-'));
    const upstreamBodies: any[] = [];
    const upstream = await startUpstream(async (_req, res, body) => {
      upstreamBodies.push(JSON.parse(body));
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id: 'cmpl_replace', choices: [{ message: { role: 'assistant', content: 'ok' } }] }));
    });
    openedServers.push(upstream);

    await proxyOpenAiRequest(
      '/v1/chat/completions',
      {
        model: 'gpt-test',
        max_context_tokens: 3000,
        messages: [
          { role: 'system', content: 'System priority: system > developer > user.' },
          { role: 'tool', name: 'rg', content: 'src/app.ts:10: exact error TS2322\n'.repeat(500) },
          { role: 'user', content: 'Current question must stay visible.' }
        ]
      },
      { workspaceRoot, upstreamBaseUrl: upstream.url, upstreamApiKey: 'key' }
    );

    expect(upstreamBodies[0].messages.map((message: any) => message.role)).toEqual(['system', 'developer', 'user']);
    expect(JSON.stringify(upstreamBodies[0].messages)).toContain('[utk-block:');
    expect(JSON.stringify(upstreamBodies[0].messages)).not.toContain('src/app.ts:10: exact error TS2322\\n'.repeat(2));
    expect(upstreamBodies[0].messages.at(-1).content).toBe('Current question must stay visible.');
  });

  it('uses route-specific compacters for json arrays, search output, file envelopes, edit success, and diagnostics', () => {
    const json = routeContentForProxy(JSON.stringify([{ id: 1, name: 'Ada' }, { id: 2, name: 'Lin' }]), 'summarize json');
    expect(json.routeReason).toBe('structured-json-array');
    expect(json.compactText).toContain('"rows":2');
    expect(json.compactText).toContain('"keys":["id","name"]');

    const search = routeContentForProxy('src/a.ts:1:first\nsrc/a.ts:2:second\nsrc/b.ts:9:third', 'rg symbol');
    expect(search.routeReason).toBe('search-results');
    expect(search.compactText).toContain('src/a.ts');
    expect(search.compactText).toContain('matches=3');

    const file = routeContentForProxy('<type>file</type>\n<path>src/app.ts</path>\nhello\nEnd of file', 'read file');
    expect(file.routeReason).toBe('file-read-envelope');
    expect(file.compactText).toContain('src/app.ts');
    expect(file.compactText).not.toContain('<type>file</type>');

    const edit = routeContentForProxy('File edited successfully.\nEnd of file', 'edit oldString');
    expect(edit.routeReason).toBe('edit-loop');
    expect(edit.compactText).toContain('OK');

    const test = routeContentForProxy('src/app.ts:10:5 - error TS2322: Type string is not assignable', 'vitest failed');
    expect(test.routeReason).toBe('test-error');
    expect(test.compactText).toContain('TS2322');
    expect(test.compactText).toContain('src/app.ts:10:5');
  });

  it('exposes proxyOpenAiRequest for library callers', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-model-proxy-lib-'));
    const upstream = await startUpstream(async (_req, res, body) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, saw: JSON.parse(body).messages[0].content }));
    });
    openedServers.push(upstream);

    const response = await proxyOpenAiRequest(
      '/v1/chat/completions',
      { model: 'gpt-test', messages: [{ role: 'tool', content: 'large output '.repeat(200) }] },
      { workspaceRoot, upstreamBaseUrl: upstream.url, upstreamApiKey: 'key', compressorRegistry: createDefaultCompressorRegistry({ fake: true }) }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true });
  });

  it('routes GitHub Models dev defaults to inference and catalog endpoints', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-model-proxy-github-models-'));
    const seen: Array<{ url?: string; authorization?: string; version?: string; body?: any }> = [];
    const upstream = await startUpstream(async (req, res, body) => {
      seen.push({
        url: req.url,
        authorization: req.headers.authorization,
        version: req.headers['x-github-api-version'] as string | undefined,
        body: body ? JSON.parse(body) : undefined
      });
      res.writeHead(200, { 'content-type': 'application/json' });
      if (req.url === '/catalog/models') {
        res.end(JSON.stringify([{ id: 'openai/gpt-4.1', name: 'OpenAI GPT-4.1' }]));
        return;
      }
      res.end(JSON.stringify({ id: 'gh_1', choices: [{ message: { role: 'assistant', content: 'ok' } }] }));
    });
    openedServers.push(upstream);

    const proxy = await createModelProxyServer({
      workspaceRoot,
      upstreamProvider: 'github-models',
      upstreamBaseUrl: `${upstream.url}/inference`,
      upstreamApiKey: 'gh-token',
      port: 0
    });
    openedServers.push(proxy);

    await fetchJson(`${proxy.url}/v1/chat/completions`, {
      model: 'openai/gpt-4.1',
      messages: [{ role: 'user', content: 'hi' }]
    });
    await fetch(`${proxy.url}/v1/models`);

    expect(seen[0]).toMatchObject({
      url: '/inference/chat/completions',
      authorization: 'Bearer gh-token',
      version: '2026-03-10'
    });
    expect(seen[1]?.url).toBe('/catalog/models');
  });

  it('routes Azure AI inference services with api-version and api-key auth', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-model-proxy-azure-ai-'));
    const seen: any[] = [];
    const upstream = await startUpstream(async (req, res, body) => {
      seen.push({ url: req.url, apiKey: req.headers['api-key'], body: JSON.parse(body) });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id: 'az_1', choices: [{ message: { role: 'assistant', content: 'ok' } }] }));
    });
    openedServers.push(upstream);

    const response = await proxyOpenAiRequest(
      '/v1/chat/completions',
      { model: 'mistral-large', messages: [{ role: 'user', content: 'hi' }] },
      {
        workspaceRoot,
        upstreamProvider: 'azure-ai-inference',
        upstreamBaseUrl: `${upstream.url}/models`,
        upstreamApiVersion: '2024-05-01-preview',
        upstreamApiKey: 'azure-key'
      }
    );

    expect(await response.json()).toMatchObject({ id: 'az_1' });
    expect(seen[0]).toMatchObject({
      url: '/models/chat/completions?api-version=2024-05-01-preview',
      apiKey: 'azure-key'
    });
  });

  it('uses a configured compression model across system, developer, and user prompts before forwarding', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-model-proxy-prompt-model-'));
    const compressionRequests: any[] = [];
    const compressor = await startUpstream(async (_req, res, body) => {
      const parsed = JSON.parse(body);
      compressionRequests.push(parsed);
      const source = parsed.messages.at(-1).content;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: `COMPRESSED:${source.slice(0, 24)}` } }] }));
    });
    openedServers.push(compressor);
    const forwarded: any[] = [];
    const upstream = await startUpstream(async (_req, res, body) => {
      forwarded.push(JSON.parse(body));
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id: 'compressed_prompt', choices: [{ message: { role: 'assistant', content: 'ok' } }] }));
    });
    openedServers.push(upstream);

    const response = await proxyOpenAiRequest(
      '/v1/chat/completions',
      {
        model: 'openai/gpt-4.1',
        messages: [
          { role: 'system', content: 'Security warning: preserve policy. ' + 'system prompt '.repeat(20) },
          { role: 'developer', content: 'Developer prompt ' + 'compress me '.repeat(20) },
          { role: 'user', content: 'User prompt ' + 'compress me too '.repeat(20) }
        ]
      },
      {
        workspaceRoot,
        upstreamBaseUrl: upstream.url,
        policyOverrides: {
          prompt_compression_enabled: true,
          prompt_compression_base_url: `${compressor.url}/inference`,
          prompt_compression_provider: 'github-models',
          prompt_compression_model: 'openai/gpt-4.1',
          prompt_compression_min_tokens: 1
        }
      }
    );

    expect(await response.json()).toMatchObject({ id: 'compressed_prompt' });
    expect(compressionRequests).toHaveLength(3);
    expect(forwarded[0].messages.map((message: any) => message.content)).toEqual([
      expect.stringContaining('COMPRESSED:'),
      expect.stringContaining('COMPRESSED:'),
      expect.stringContaining('COMPRESSED:')
    ]);
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

async function fetchJson(url: string, body: unknown): Promise<any> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  expect(response.status).toBe(200);
  return response.json();
}

function tool(name: string, description: string): Record<string, any> {
  return {
    type: 'function',
    function: {
      name,
      description,
      parameters: { type: 'object', properties: { path: { type: 'string' } } }
    }
  };
}
