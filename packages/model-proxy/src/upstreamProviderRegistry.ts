import {
  DEFAULT_UPSTREAM_PROVIDER,
  DEFAULT_UPSTREAM_PROVIDER_ADAPTERS,
  GITHUB_MODELS_UPSTREAM_PROVIDER_ADAPTER
} from './upstreamProviderBuiltins.js';
import type {
  UpstreamProvider,
  UpstreamProviderAdapter,
  UpstreamProviderOptions,
  UpstreamProviderRequest,
  UpstreamProviderRequestInput
} from './upstreamProviderTypes.js';

export function createUpstreamRequest(adapter: UpstreamProviderAdapter, options: UpstreamProviderRequestInput): UpstreamProviderRequest {
  const providerOptions = adapter.optionsFromConfig?.(options.providerOptions ?? {}) ?? options.providerOptions ?? {};
  return adapter.buildRequest({ ...options, providerOptions });
}

export function resolveUpstreamProviderAdapter(
  provider: UpstreamProvider | undefined,
  adapters: readonly UpstreamProviderAdapter[] = DEFAULT_UPSTREAM_PROVIDER_ADAPTERS
): UpstreamProviderAdapter {
  if (!provider) return findUpstreamProviderAdapter(DEFAULT_UPSTREAM_PROVIDER, adapters) ?? GITHUB_MODELS_UPSTREAM_PROVIDER_ADAPTER;
  const adapter = findUpstreamProviderAdapter(provider, adapters);
  if (adapter) return adapter;
  throw new Error(`Unsupported upstream provider adapter: ${provider}`);
}

export function findUpstreamProviderAdapter(
  provider: UpstreamProvider | undefined,
  adapters: readonly UpstreamProviderAdapter[] = DEFAULT_UPSTREAM_PROVIDER_ADAPTERS
): UpstreamProviderAdapter | undefined {
  if (!provider) return undefined;
  return adapters.find((adapter) => adapter.id === provider);
}

export function readUpstreamProvider(
  value: string | undefined,
  adapters: readonly UpstreamProviderAdapter[] = DEFAULT_UPSTREAM_PROVIDER_ADAPTERS
): UpstreamProvider {
  return resolveUpstreamProviderAdapter(value, adapters).id;
}

export function defaultUpstreamBaseUrl(
  provider: UpstreamProvider,
  adapters: readonly UpstreamProviderAdapter[] = DEFAULT_UPSTREAM_PROVIDER_ADAPTERS
): string {
  return resolveUpstreamProviderAdapter(provider, adapters).defaults.baseUrl;
}

export function defaultUpstreamApiVersion(
  provider: UpstreamProvider,
  adapters: readonly UpstreamProviderAdapter[] = DEFAULT_UPSTREAM_PROVIDER_ADAPTERS
): string {
  return resolveUpstreamProviderAdapter(provider, adapters).defaults.apiVersion;
}

export function joinUpstreamUrl(baseUrl: string, route: string, options: {
  provider?: UpstreamProvider;
  apiVersion?: string;
  organization?: string;
  providerOptions?: UpstreamProviderOptions;
  adapters?: readonly UpstreamProviderAdapter[];
} = {}): string {
  const adapter = resolveUpstreamProviderAdapter(options.provider ?? 'openai', options.adapters);
  return createUpstreamRequest(adapter, {
    baseUrl,
    route,
    apiVersion: options.apiVersion,
    organization: options.organization,
    providerOptions: options.providerOptions
  }).url;
}

export function upstreamHeaders(provider: UpstreamProvider, options: {
  upstreamApiKey?: string;
  upstreamApiVersion?: string;
  providerOptions?: UpstreamProviderOptions;
  adapters?: readonly UpstreamProviderAdapter[];
} = {}): Record<string, string> {
  const adapter = resolveUpstreamProviderAdapter(provider, options.adapters);
  return createUpstreamRequest(adapter, {
    baseUrl: '',
    route: '',
    apiKey: options.upstreamApiKey,
    apiVersion: options.upstreamApiVersion,
    providerOptions: options.providerOptions
  }).headers;
}
