#!/usr/bin/env node
/* c8 ignore file -- covered by model-proxy behavior tests; HTTP server branches are integration-tested. */
import { createServer, type Server } from 'node:http';
import path from 'node:path';
import { resolveModelProxyPolicy, type ModelProxyPolicy } from '@utk/core';
import { createDefaultCompressorRegistry, type CompressorRegistry } from './contextGateway.js';
import { createMetricsStore, type ModelProxyMetricsStore } from './metrics.js';
import type { LocalToolExecutor } from './proxy.js';
import { handleModelProxyRequest } from './serverRequestHandler.js';
import {
  resolveUpstreamProviderAdapter,
  type UpstreamProvider,
  type UpstreamProviderAdapter,
  type UpstreamProviderOptions
} from './upstreamProvider.js';

export type ModelProxyServerOptions = {
  workspaceRoot?: string;
  host?: string;
  port?: number;
  upstreamBaseUrl?: string;
  upstreamProvider?: UpstreamProvider;
  upstreamProviderAdapter?: UpstreamProviderAdapter;
  upstreamProviderAdapters?: readonly UpstreamProviderAdapter[];
  upstreamProviderOptions?: UpstreamProviderOptions;
  promptCompressionProviderAdapters?: readonly UpstreamProviderAdapter[];
  promptCompressionProviderOptions?: UpstreamProviderOptions;
  upstreamApiVersion?: string;
  upstreamOrganization?: string;
  upstreamApiKey?: string;
  upstreamTimeoutMs?: number;
  compressorRegistry?: CompressorRegistry;
  toolExecutor?: LocalToolExecutor;
  mediateLocalToolResults?: boolean;
};

export type ModelProxyServer = {
  server: Server;
  url: string;
  metricsStore: ModelProxyMetricsStore;
  close(): Promise<void>;
};

export async function createModelProxyServer(options: ModelProxyServerOptions = {}): Promise<ModelProxyServer> {
  const workspaceRoot = path.resolve(options.workspaceRoot ?? process.env.UTK_MODEL_PROXY_WORKSPACE_ROOT ?? process.cwd());
  const policy = await resolveModelProxyPolicy(workspaceRoot, process.env);
  const host = options.host ?? process.env.UTK_MODEL_PROXY_HOST ?? '127.0.0.1';
  const port = options.port ?? Number(process.env.UTK_MODEL_PROXY_PORT ?? 8787);
  const providerOverride = options.upstreamProvider ?? process.env.UTK_MODEL_PROXY_UPSTREAM_PROVIDER;
  const configuredProvider = providerOverride ?? policy.upstream_provider;
  const upstreamProviderAdapter = options.upstreamProviderAdapter ??
    resolveUpstreamProviderAdapter(configuredProvider, options.upstreamProviderAdapters);
  const upstreamProvider = upstreamProviderAdapter.id;
  const providerMatchesPolicy = !providerOverride || providerOverride === policy.upstream_provider;
  const upstreamBaseUrl = options.upstreamBaseUrl ?? process.env.UTK_MODEL_PROXY_UPSTREAM_BASE_URL ?? configuredProviderValue(providerMatchesPolicy ? policy.upstream_base_url : '', upstreamProviderAdapter.defaults.baseUrl);
  const upstreamApiVersion = options.upstreamApiVersion ?? process.env.UTK_MODEL_PROXY_UPSTREAM_API_VERSION ?? configuredProviderValue(providerMatchesPolicy ? policy.upstream_api_version : '', upstreamProviderAdapter.defaults.apiVersion);
  const upstreamOrganization = options.upstreamOrganization ?? process.env.UTK_MODEL_PROXY_UPSTREAM_ORGANIZATION ?? emptyAsUndefined(policy.upstream_organization);
  const upstreamApiKey = options.upstreamApiKey ?? process.env.UTK_MODEL_PROXY_UPSTREAM_API_KEY ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? process.env.OPENAI_API_KEY;
  const upstreamTimeoutMs = readPositiveNumber(options.upstreamTimeoutMs ?? process.env.UTK_MODEL_PROXY_UPSTREAM_TIMEOUT_MS, 10000);
  const upstreamProviderOptions = options.upstreamProviderOptions ?? providerOptionsFor(policy, upstreamProvider);
  const compressorRegistry = options.compressorRegistry ?? createDefaultCompressorRegistry();
  const metricsStore = createMetricsStore(workspaceRoot);

  const server = createServer((req, res) => {
    void handleModelProxyRequest(req, res, {
      workspaceRoot,
      upstreamBaseUrl,
      upstreamProvider,
      upstreamProviderAdapter,
      upstreamProviderOptions,
      upstreamApiVersion,
      upstreamOrganization,
      upstreamApiKey,
      upstreamTimeoutMs,
      compressorRegistry,
      metricsStore,
      toolExecutor: options.toolExecutor,
      mediateLocalToolResults: options.mediateLocalToolResults,
      promptCompressionProviderAdapters: options.promptCompressionProviderAdapters ?? options.upstreamProviderAdapters,
      promptCompressionProviderOptions: options.promptCompressionProviderOptions
    });
  });
  await new Promise<void>((resolve) => server.listen(port, host, resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('model proxy did not bind to a TCP port');
  return {
    server,
    url: `http://${host}:${address.port}`,
    metricsStore,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  };
}

function readPositiveNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function providerOptionsFor(policy: ModelProxyPolicy, provider: UpstreamProvider): UpstreamProviderOptions | undefined {
  const options = policy.provider_options[provider];
  return options && Object.keys(options).length > 0 ? options : undefined;
}

function configuredProviderValue(value: string, fallback: string): string {
  return value.trim() ? value : fallback;
}

function emptyAsUndefined(value: string): string | undefined {
  return value.trim() ? value : undefined;
}

/* c8 ignore start */
if (import.meta.url === `file://${process.argv[1]?.replaceAll('\\', '/')}`) {
  const proxy = await createModelProxyServer();
  process.stderr.write(`utk-model-proxy listening on ${proxy.url}\n`);
  const close = async (): Promise<void> => {
    await proxy.close();
    process.exit(0);
  };
  process.once('SIGINT', () => void close());
  process.once('SIGTERM', () => void close());
}
/* c8 ignore stop */
