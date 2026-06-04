import type { ProviderCustomCapability } from '../types/project';
import {
  createAnthropicProviderAdapter,
  type AnthropicCredentialResolver,
  type AnthropicFetchLike,
} from './anthropicProviderAdapter';
import {
  createCustomOpenAiCompatibleProviderAdapter,
  type CustomOpenAiCompatibleCredentialResolver,
  type CustomOpenAiCompatibleFetchLike,
} from './customOpenAiCompatibleProviderAdapter';
import {
  createDeepSeekProviderAdapter,
  type DeepSeekCredentialResolver,
  type DeepSeekFetchLike,
} from './deepSeekProviderAdapter';
import {
  createKimiProviderAdapter,
  type KimiCredentialResolver,
  type KimiFetchLike,
} from './kimiProviderAdapter';
import {
  createMiniMaxProviderAdapter,
  type MiniMaxCredentialResolver,
  type MiniMaxFetchLike,
} from './miniMaxProviderAdapter';
import { createMockProviderAdapter } from './mockProviderAdapter';
import { createOpenCodeWorkflowAdapter } from './openCodeWorkflowAdapter';
import {
  createOpenAiProviderAdapter,
  type OpenAiCredentialResolver,
  type OpenAiFetchLike,
} from './openAiProviderAdapter';
import type { ProviderAdapter } from './providerAdapter';
import { defaultProviderRegistry } from './providerRegistry';

export interface ProviderAdapterHubCredentialLookup {
  providerId: string;
  envVar?: string;
}

export type ProviderAdapterHubCredentialResolver = (
  lookup: ProviderAdapterHubCredentialLookup,
) => string | null | undefined | Promise<string | null | undefined>;

type ProviderAdapterHubFetchLike = (
  url: string,
  init: {
    method: 'POST';
    headers: Record<string, string>;
    body: string;
    signal?: AbortSignal;
  },
) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  headers?: {
    get(name: string): string | null;
  } | Record<string, string | undefined>;
  json(): Promise<unknown>;
  text?(): Promise<string>;
}>;

export interface ProviderAdapterHubOptions {
  fetch?: ProviderAdapterHubFetchLike;
  credentialResolver?: ProviderAdapterHubCredentialResolver;
  workspaceRoot?: string;
  knownSecrets?: string[];
  customEndpoint?: {
    baseUrl?: string;
    modelId?: string;
    capabilities?: ProviderCustomCapability[];
  };
}

export interface ProviderAdapterHub {
  listProviderIds(): string[];
  getAdapter(providerId: string): ProviderAdapter | undefined;
}

function providerCredentialResolver(
  resolver: ProviderAdapterHubCredentialResolver | undefined,
): ProviderAdapterHubCredentialResolver | undefined {
  return resolver
    ? lookup => resolver({ providerId: lookup.providerId, envVar: lookup.envVar })
    : undefined;
}

export function createProviderAdapterHub(options: ProviderAdapterHubOptions = {}): ProviderAdapterHub {
  const credentialResolver = providerCredentialResolver(options.credentialResolver);
  const fetch = options.fetch;
  const adapters = new Map<string, ProviderAdapter>();

  adapters.set('openai', createOpenAiProviderAdapter({
    fetch: fetch as OpenAiFetchLike | undefined,
    credentialResolver: credentialResolver as OpenAiCredentialResolver | undefined,
  }));
  adapters.set('anthropic', createAnthropicProviderAdapter({
    fetch: fetch as AnthropicFetchLike | undefined,
    credentialResolver: credentialResolver as AnthropicCredentialResolver | undefined,
  }));
  adapters.set('moonshot', createKimiProviderAdapter({
    fetch: fetch as KimiFetchLike | undefined,
    credentialResolver: credentialResolver as KimiCredentialResolver | undefined,
  }));
  adapters.set('deepseek', createDeepSeekProviderAdapter({
    fetch: fetch as DeepSeekFetchLike | undefined,
    credentialResolver: credentialResolver as DeepSeekCredentialResolver | undefined,
  }));
  adapters.set('minimax', createMiniMaxProviderAdapter({
    fetch: fetch as MiniMaxFetchLike | undefined,
    credentialResolver: credentialResolver as MiniMaxCredentialResolver | undefined,
  }));
  adapters.set('opencode', createOpenCodeWorkflowAdapter({
    workspaceRoot: options.workspaceRoot,
    knownSecrets: options.knownSecrets,
  }));
  adapters.set('custom', createCustomOpenAiCompatibleProviderAdapter({
    fetch: fetch as CustomOpenAiCompatibleFetchLike | undefined,
    credentialResolver: credentialResolver as CustomOpenAiCompatibleCredentialResolver | undefined,
    baseUrl: options.customEndpoint?.baseUrl,
    defaultModelId: options.customEndpoint?.modelId,
    capabilities: options.customEndpoint?.capabilities,
  }));
  adapters.set('local', createMockProviderAdapter());

  return {
    listProviderIds: () => defaultProviderRegistry.map(provider => provider.id),
    getAdapter: providerId => adapters.get(providerId),
  };
}
