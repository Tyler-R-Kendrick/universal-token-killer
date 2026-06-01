import { DEFAULT_MODEL_PROXY_PROVIDER, MODEL_PROXY_PROVIDER_DEFAULTS } from '@utk/core';
import {
  createUpstreamProviderAdapter,
  type UpstreamProviderDefaults,
  type UpstreamProviderOptions,
  type UpstreamProviderRequest,
  type UpstreamProviderRequestContext,
  type UpstreamProviderRequestInput
} from './upstreamProviderTypes.js';

export type BuiltInUpstreamProvider = keyof typeof MODEL_PROXY_PROVIDER_DEFAULTS;
export type OpenAiUpstreamProviderOptions = Record<string, never>;
export type AzureOpenAiUpstreamProviderOptions = Record<string, never>;
export type GitHubModelsUpstreamProviderOptions = { organization?: string };
export type AzureAiInferenceUpstreamProviderOptions = { apiVersion?: string };

const OPENAI_DEFAULTS = providerDefaults('openai');
const GITHUB_MODELS_DEFAULTS = providerDefaults('github-models');
const AZURE_OPENAI_DEFAULTS = providerDefaults('azure-openai');
const AZURE_AI_INFERENCE_DEFAULTS = providerDefaults('azure-ai-inference');

export const DEFAULT_UPSTREAM_PROVIDER = DEFAULT_MODEL_PROXY_PROVIDER;

export const OPENAI_UPSTREAM_PROVIDER_ADAPTER = createUpstreamProviderAdapter<OpenAiUpstreamProviderOptions>({
  id: 'openai',
  defaults: OPENAI_DEFAULTS,
  buildRequest: (options) => openAiCompatibleRequest(options, bearerJsonHeaders)
});

export const GITHUB_MODELS_UPSTREAM_PROVIDER_ADAPTER = createUpstreamProviderAdapter<GitHubModelsUpstreamProviderOptions>({
  id: 'github-models',
  defaults: GITHUB_MODELS_DEFAULTS,
  optionsFromConfig(options) {
    return { organization: stringOption(options, 'organization') };
  },
  buildRequest(options) {
    return {
      url: githubModelsUrl(options),
      headers: {
        ...bearerJsonHeaders(options),
        accept: 'application/vnd.github+json',
        'x-github-api-version': options.apiVersion ?? GITHUB_MODELS_DEFAULTS.apiVersion
      }
    };
  }
});

export const AZURE_OPENAI_UPSTREAM_PROVIDER_ADAPTER = createUpstreamProviderAdapter<AzureOpenAiUpstreamProviderOptions>({
  id: 'azure-openai',
  defaults: AZURE_OPENAI_DEFAULTS,
  buildRequest: (options) => openAiCompatibleRequest(options, apiKeyJsonHeaders)
});

export const AZURE_AI_INFERENCE_UPSTREAM_PROVIDER_ADAPTER = createUpstreamProviderAdapter<AzureAiInferenceUpstreamProviderOptions>({
  id: 'azure-ai-inference',
  defaults: AZURE_AI_INFERENCE_DEFAULTS,
  optionsFromConfig(options) {
    return { apiVersion: stringOption(options, 'api_version') };
  },
  buildRequest(options) {
    const apiVersion = options.apiVersion ?? options.providerOptions.apiVersion ?? AZURE_AI_INFERENCE_DEFAULTS.apiVersion;
    const base = trimTrailingSlash(options.baseUrl);
    const separator = base.includes('?') ? '&' : '?';
    const version = `api-version=${encodeURIComponent(apiVersion)}`;
    const route = options.route === '/v1/chat/completions'
      ? '/chat/completions'
      : options.route === '/v1/models'
        ? ''
        : options.route.replace(/^\/v1/, '');
    return {
      url: `${base}${route}${separator}${version}`,
      headers: apiKeyJsonHeaders(options)
    };
  }
});

export const DEFAULT_UPSTREAM_PROVIDER_ADAPTERS = [
  OPENAI_UPSTREAM_PROVIDER_ADAPTER,
  GITHUB_MODELS_UPSTREAM_PROVIDER_ADAPTER,
  AZURE_OPENAI_UPSTREAM_PROVIDER_ADAPTER,
  AZURE_AI_INFERENCE_UPSTREAM_PROVIDER_ADAPTER
] as const;

function openAiCompatibleRequest(
  options: UpstreamProviderRequestContext<UpstreamProviderOptions>,
  headers: (options: UpstreamProviderRequestInput) => Record<string, string>
): UpstreamProviderRequest {
  return { url: openAiCompatibleUrl(options), headers: headers(options) };
}

function openAiCompatibleUrl(options: UpstreamProviderRequestInput): string {
  const base = trimTrailingSlash(options.baseUrl);
  const normalizedRoute = base.endsWith('/v1') && options.route.startsWith('/v1/')
    ? options.route.slice(3)
    : options.route;
  return `${base}${normalizedRoute.startsWith('/') ? '' : '/'}${normalizedRoute}`;
}

function githubModelsUrl(options: UpstreamProviderRequestContext<GitHubModelsUpstreamProviderOptions>): string {
  const base = trimTrailingSlash(options.baseUrl);
  const root = base.replace(/\/inference$/, '');
  if (options.route === '/v1/models') return `${root}/catalog/models`;
  if (options.route === '/v1/chat/completions') {
    const organization = options.organization ?? options.providerOptions.organization;
    return organization
      ? `${root}/orgs/${encodeURIComponent(organization)}/inference/chat/completions`
      : `${base}/chat/completions`;
  }
  return `${base}${options.route.replace(/^\/v1/, '')}`;
}

function bearerJsonHeaders(options: UpstreamProviderRequestInput): Record<string, string> {
  const headers = jsonHeaders();
  const apiKey = readApiKey(options);
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  return headers;
}

function apiKeyJsonHeaders(options: UpstreamProviderRequestInput): Record<string, string> {
  const headers = jsonHeaders();
  const apiKey = readApiKey(options);
  if (apiKey) headers['api-key'] = apiKey;
  return headers;
}

function jsonHeaders(): Record<string, string> {
  return { 'content-type': 'application/json' };
}

function readApiKey(options: UpstreamProviderRequestInput): string | undefined {
  return options.apiKey ??
    process.env.UTK_MODEL_PROXY_UPSTREAM_API_KEY ??
    process.env.GITHUB_TOKEN ??
    process.env.GH_TOKEN ??
    process.env.OPENAI_API_KEY;
}

function stringOption(options: UpstreamProviderOptions, key: string): string | undefined {
  const value = options[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, '');
}

function providerDefaults(id: BuiltInUpstreamProvider): UpstreamProviderDefaults {
  return MODEL_PROXY_PROVIDER_DEFAULTS[id];
}
