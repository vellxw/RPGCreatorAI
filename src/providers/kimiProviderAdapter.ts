import {
  createOpenAiCompatibleProviderAdapter,
  type OpenAiCompatibleCredentialResolver,
  type OpenAiCompatibleFetchLike,
} from './openAiCompatibleProviderAdapter';
import type { ProviderAdapter } from './providerAdapter';

export type KimiCredentialResolver = OpenAiCompatibleCredentialResolver;
export type KimiFetchLike = OpenAiCompatibleFetchLike;

export interface KimiProviderAdapterOptions {
  fetch?: KimiFetchLike;
  credentialResolver?: KimiCredentialResolver;
  baseUrl?: string;
}

export function createKimiProviderAdapter(options: KimiProviderAdapterOptions = {}): ProviderAdapter {
  return createOpenAiCompatibleProviderAdapter({
    providerId: 'moonshot',
    providerLabel: 'Kimi / Moonshot',
    defaultBaseUrl: 'https://api.moonshot.ai/v1',
    defaultModelId: 'kimi-k2.6',
    ...options,
  });
}
