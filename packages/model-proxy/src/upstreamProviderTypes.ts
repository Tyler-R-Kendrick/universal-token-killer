import type { ModelProxyProviderDefaults, ModelProxyProviderId } from '@utk/core';

export type UpstreamProvider = ModelProxyProviderId;
export type UpstreamProviderDefaults = ModelProxyProviderDefaults;
export type UpstreamProviderOptions = Record<string, unknown>;

export type UpstreamProviderRequestInput = {
  baseUrl: string;
  route: string;
  apiKey?: string;
  apiVersion?: string;
  organization?: string;
  providerOptions?: UpstreamProviderOptions;
};

export type UpstreamProviderRequestContext<TProviderOptions extends object> =
  Omit<UpstreamProviderRequestInput, 'providerOptions'> & {
    providerOptions: TProviderOptions;
  };

export type UpstreamProviderRequest = {
  url: string;
  headers: Record<string, string>;
};

export type UpstreamProviderAdapter<TProviderOptions extends object = UpstreamProviderOptions> = {
  id: UpstreamProvider;
  defaults: UpstreamProviderDefaults;
  optionsFromConfig?(options: UpstreamProviderOptions): TProviderOptions;
  buildRequest(options: UpstreamProviderRequestContext<TProviderOptions>): UpstreamProviderRequest;
};

export function createUpstreamProviderAdapter<TProviderOptions extends object>(definition: {
  id: UpstreamProvider;
  defaults: UpstreamProviderDefaults;
  optionsFromConfig?(options: UpstreamProviderOptions): TProviderOptions;
  buildRequest(options: UpstreamProviderRequestContext<TProviderOptions>): UpstreamProviderRequest;
}): UpstreamProviderAdapter<TProviderOptions> {
  return definition;
}
