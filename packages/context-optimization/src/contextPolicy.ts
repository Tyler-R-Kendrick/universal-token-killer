import { loadUtkConfig, type UtkConfig } from '@utk/config';

export type ModelProxyPolicy = UtkConfig['model_proxy'];

export async function resolveModelProxyPolicy(
  workspaceRoot: string,
  env: Record<string, string | undefined> = process.env,
  overrides: Partial<ModelProxyPolicy> = {}
): Promise<ModelProxyPolicy> {
  const config = await loadUtkConfig(workspaceRoot);
  return {
    ...config.model_proxy,
    ...modelProxyPolicyEnvOverrides(env),
    ...overrides
  };
}

function modelProxyPolicyEnvOverrides(env: Record<string, string | undefined>): Partial<ModelProxyPolicy> {
  const envOverrides: Partial<ModelProxyPolicy> = {};
  if (isToolDiscoveryMode(env.UTK_MODEL_PROXY_TOOL_DISCOVERY_MODE)) {
    envOverrides.tool_discovery_mode = env.UTK_MODEL_PROXY_TOOL_DISCOVERY_MODE;
  }
  if (env.UTK_MODEL_PROXY_REMOTE_COMPRESSORS_ENABLED !== undefined) {
    envOverrides.remote_compressors_enabled = parseEnvBoolean(env.UTK_MODEL_PROXY_REMOTE_COMPRESSORS_ENABLED);
  }
  if (env.UTK_MODEL_PROXY_PROVIDER_STRICT_MODE !== undefined) {
    envOverrides.provider_strict_mode = parseEnvBoolean(env.UTK_MODEL_PROXY_PROVIDER_STRICT_MODE);
  }
  if (env.UTK_MODEL_PROXY_UPSTREAM_PROVIDER?.trim()) envOverrides.upstream_provider = env.UTK_MODEL_PROXY_UPSTREAM_PROVIDER;
  if (env.UTK_MODEL_PROXY_PROMPT_COMPRESSION_PROVIDER?.trim()) envOverrides.prompt_compression_provider = env.UTK_MODEL_PROXY_PROMPT_COMPRESSION_PROVIDER;
  if (env.UTK_MODEL_PROXY_PROMPT_COMPRESSION_ENABLED !== undefined) {
    envOverrides.prompt_compression_enabled = parseEnvBoolean(env.UTK_MODEL_PROXY_PROMPT_COMPRESSION_ENABLED);
  }
  if (env.UTK_MODEL_PROXY_PROMPT_COMPRESSION_BASE_URL) {
    envOverrides.prompt_compression_base_url = env.UTK_MODEL_PROXY_PROMPT_COMPRESSION_BASE_URL;
  }
  if (env.UTK_MODEL_PROXY_PROMPT_COMPRESSION_MODEL) {
    envOverrides.prompt_compression_model = env.UTK_MODEL_PROXY_PROMPT_COMPRESSION_MODEL;
  }
  if (env.UTK_MODEL_PROXY_PROMPT_COMPRESSION_API_VERSION) {
    envOverrides.prompt_compression_api_version = env.UTK_MODEL_PROXY_PROMPT_COMPRESSION_API_VERSION;
  }
  if (env.UTK_MODEL_PROXY_PROMPT_COMPRESSION_TIMEOUT_MS) {
    envOverrides.prompt_compression_timeout_ms = Number(env.UTK_MODEL_PROXY_PROMPT_COMPRESSION_TIMEOUT_MS);
  }
  return envOverrides;
}

function isToolDiscoveryMode(value: string | undefined): value is ModelProxyPolicy['tool_discovery_mode'] {
  return value === 'off' || value === 'static-filter' || value === 'deferred-search';
}

function parseEnvBoolean(value: string): boolean {
  return /^(1|true|yes|on)$/i.test(value);
}
