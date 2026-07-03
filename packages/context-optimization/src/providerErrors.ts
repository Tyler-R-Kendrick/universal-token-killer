export type ProviderErrorKind = 'auth' | 'rate-limit' | 'timeout' | 'request-too-large' | 'unavailable' | 'policy-denied';

type ProviderErrorLike = { status?: number; name?: string; message?: string };

export function classifyProviderError(error: unknown): ProviderErrorKind {
  const value = providerErrorLike(error);
  const message = String(value?.message ?? error ?? '').toLowerCase();
  if (value?.status === 401 || value?.status === 403) return 'auth';
  if (value?.status === 429) return 'rate-limit';
  if (value?.name === 'AbortError' || message.includes('timeout')) return 'timeout';
  if (value?.status === 413 || message.includes('too large')) return 'request-too-large';
  if (message.includes('policy')) return 'policy-denied';
  return 'unavailable';
}

function providerErrorLike(error: unknown): ProviderErrorLike | undefined {
  return isObject(error) ? {
    status: typeof error.status === 'number' ? error.status : undefined,
    name: typeof error.name === 'string' ? error.name : undefined,
    message: typeof error.message === 'string' ? error.message : undefined
  } : undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
