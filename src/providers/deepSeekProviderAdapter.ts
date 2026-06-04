import {
  createOpenAiCompatibleProviderAdapter,
  type OpenAiCompatibleCredentialResolver,
  type OpenAiCompatibleFetchLike,
} from './openAiCompatibleProviderAdapter';
import type { ProviderAdapter } from './providerAdapter';

export type DeepSeekCredentialResolver = OpenAiCompatibleCredentialResolver;
export type DeepSeekFetchLike = OpenAiCompatibleFetchLike;

export interface DeepSeekProviderAdapterOptions {
  fetch?: DeepSeekFetchLike;
  credentialResolver?: DeepSeekCredentialResolver;
  baseUrl?: string;
}

export function createDeepSeekProviderAdapter(options: DeepSeekProviderAdapterOptions = {}): ProviderAdapter {
  return createOpenAiCompatibleProviderAdapter({
    providerId: 'deepseek',
    providerLabel: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com',
    defaultModelId: 'deepseek-v4-flash',
    maxTokensField: 'max_tokens',
    ...options,
  });
}
