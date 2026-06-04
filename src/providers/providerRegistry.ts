import type { ProviderConfig } from '../types/project';

export type ProviderOperation =
  | 'text.generate'
  | 'image.generate'
  | 'image.edit'
  | 'vision.analyze'
  | 'code.assist'
  | 'audio.generate'
  | 'video.generate';

export type ProviderAdapterKind =
  | 'official-api'
  | 'openai-compatible'
  | 'external-tool'
  | 'mock-local';

export type ProviderModelSelection = 'user-selected' | 'registry' | 'not-required' | 'required-default';

export interface ProviderModelDescriptor {
  id: string;
  label: string;
  operations: ProviderOperation[];
}

export interface ProviderCredentialMetadata {
  required: boolean;
  envVar?: string;
}

export type ProviderCostEstimateAvailability = 'free' | 'estimated' | 'unknown';
export type ProviderCostConfirmationPolicy =
  | 'none'
  | 'confirm-paid-session'
  | 'confirm-expensive-session';

export interface ProviderCostMetadata {
  estimateAvailability: ProviderCostEstimateAvailability;
  paidOperations: boolean;
  confirmationPolicy: ProviderCostConfirmationPolicy;
  currency?: 'USD';
  expensiveJobThresholdUsd?: number;
  detail?: string;
}

export type ProviderRateLimitStatus = 'not-applicable' | 'provider-managed' | 'unknown';

export interface ProviderRateLimitMetadata {
  status: ProviderRateLimitStatus;
  retryGuidance: string;
  quotaGuidance?: string;
}

export interface ProviderMetadata {
  id: string;
  name: string;
  adapterKind: ProviderAdapterKind;
  credential: ProviderCredentialMetadata;
  cost: ProviderCostMetadata;
  rateLimit: ProviderRateLimitMetadata;
  operations: ProviderOperation[];
  capabilityLabels?: string[];
  models: ProviderModelDescriptor[];
  modelSelection: ProviderModelSelection;
  baseUrl?: {
    configurable: boolean;
    defaultValue?: string;
  };
}

const operationLabels: Record<ProviderOperation, string> = {
  'text.generate': 'Text generation',
  'image.generate': 'Image generation',
  'image.edit': 'Image editing',
  'vision.analyze': 'Vision analysis',
  'code.assist': 'Code assistance',
  'audio.generate': 'Audio generation',
  'video.generate': 'Video generation',
};

const paidUnknownCost: ProviderCostMetadata = {
  estimateAvailability: 'unknown',
  paidOperations: true,
  confirmationPolicy: 'confirm-paid-session',
  currency: 'USD',
  detail: 'Exact pricing is not stored in this local registry.',
};

const freeOfflineCost: ProviderCostMetadata = {
  estimateAvailability: 'free',
  paidOperations: false,
  confirmationPolicy: 'none',
  detail: 'Offline mock provider does not call paid services.',
};

const providerManagedRateLimit: ProviderRateLimitMetadata = {
  status: 'provider-managed',
  retryGuidance: 'Retry only after provider guidance or a returned retry-after interval.',
  quotaGuidance: 'Review provider dashboard quota and local budget settings before retrying.',
};

const noRemoteRateLimit: ProviderRateLimitMetadata = {
  status: 'not-applicable',
  retryGuidance: 'No remote provider retry window applies to offline mock requests.',
};

export const defaultProviderRegistry: ProviderMetadata[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    adapterKind: 'official-api',
    credential: { required: true, envVar: 'OPENAI_API_KEY' },
    cost: paidUnknownCost,
    rateLimit: providerManagedRateLimit,
    operations: ['text.generate', 'image.generate', 'image.edit', 'vision.analyze'],
    models: [
      {
        id: 'gpt-5.5',
        label: 'GPT-5.5',
        operations: ['text.generate', 'vision.analyze'],
      },
      {
        id: 'gpt-image-2',
        label: 'GPT Image 2',
        operations: ['image.generate', 'image.edit'],
      },
    ],
    modelSelection: 'user-selected',
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    adapterKind: 'official-api',
    credential: { required: true, envVar: 'ANTHROPIC_API_KEY' },
    cost: paidUnknownCost,
    rateLimit: providerManagedRateLimit,
    operations: ['text.generate', 'code.assist'],
    capabilityLabels: ['Text generation', 'Code assistance', 'Planning'],
    models: [
      {
        id: 'claude-opus-4-8',
        label: 'Claude Opus 4.8',
        operations: ['text.generate', 'code.assist'],
      },
      {
        id: 'claude-sonnet-4-6',
        label: 'Claude Sonnet 4.6',
        operations: ['text.generate', 'code.assist'],
      },
      {
        id: 'claude-haiku-4-5-20251001',
        label: 'Claude Haiku 4.5',
        operations: ['text.generate', 'code.assist'],
      },
    ],
    modelSelection: 'user-selected',
  },
  {
    id: 'moonshot',
    name: 'Kimi / Moonshot',
    adapterKind: 'openai-compatible',
    credential: { required: true, envVar: 'MOONSHOT_API_KEY' },
    cost: paidUnknownCost,
    rateLimit: providerManagedRateLimit,
    operations: ['text.generate', 'code.assist'],
    capabilityLabels: ['Text generation', 'Code assistance', 'OpenAI-compatible endpoint'],
    models: [
      {
        id: 'kimi-k2.6',
        label: 'Kimi K2.6',
        operations: ['text.generate', 'code.assist'],
      },
      {
        id: 'kimi-k2.5',
        label: 'Kimi K2.5',
        operations: ['text.generate', 'code.assist'],
      },
      {
        id: 'moonshot-v1-128k',
        label: 'Moonshot v1 128k',
        operations: ['text.generate'],
      },
      {
        id: 'moonshot-v1-32k',
        label: 'Moonshot v1 32k',
        operations: ['text.generate'],
      },
      {
        id: 'moonshot-v1-8k',
        label: 'Moonshot v1 8k',
        operations: ['text.generate'],
      },
    ],
    modelSelection: 'user-selected',
    baseUrl: { configurable: true, defaultValue: 'https://api.moonshot.ai/v1' },
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    adapterKind: 'openai-compatible',
    credential: { required: true, envVar: 'DEEPSEEK_API_KEY' },
    cost: paidUnknownCost,
    rateLimit: providerManagedRateLimit,
    operations: ['text.generate', 'code.assist'],
    capabilityLabels: ['Text generation', 'Code assistance', 'OpenAI-compatible endpoint'],
    models: [],
    modelSelection: 'user-selected',
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    adapterKind: 'official-api',
    credential: { required: true, envVar: 'MINIMAX_API_KEY' },
    cost: paidUnknownCost,
    rateLimit: providerManagedRateLimit,
    operations: ['text.generate', 'image.generate', 'video.generate', 'audio.generate'],
    models: [],
    modelSelection: 'user-selected',
  },
  {
    id: 'opencode',
    name: 'OpenCode adapter',
    adapterKind: 'external-tool',
    credential: { required: false },
    cost: {
      estimateAvailability: 'unknown',
      paidOperations: false,
      confirmationPolicy: 'none',
      detail: 'External tool cost is outside the provider registry.',
    },
    rateLimit: {
      status: 'unknown',
      retryGuidance: 'Review the external tool output before retrying.',
    },
    operations: ['code.assist'],
    capabilityLabels: ['Code assistance', 'External tool adapter'],
    models: [],
    modelSelection: 'not-required',
  },
  {
    id: 'custom',
    name: 'Custom OpenAI-compatible endpoint',
    adapterKind: 'openai-compatible',
    credential: { required: true, envVar: 'CUSTOM_OPENAI_API_KEY' },
    cost: paidUnknownCost,
    rateLimit: providerManagedRateLimit,
    operations: ['text.generate'],
    capabilityLabels: ['Text generation', 'OpenAI-compatible endpoint'],
    models: [],
    modelSelection: 'user-selected',
    baseUrl: { configurable: true },
  },
  {
    id: 'local',
    name: 'Local gateway',
    adapterKind: 'mock-local',
    credential: { required: false },
    cost: freeOfflineCost,
    rateLimit: noRemoteRateLimit,
    operations: ['text.generate', 'image.generate', 'image.edit'],
    capabilityLabels: ['Offline mock contracts'],
    models: [
      {
        id: 'offline-mock',
        label: 'Offline mock',
        operations: ['text.generate'],
      },
      {
        id: 'offline-image-mock',
        label: 'Offline image mock',
        operations: ['image.generate'],
      },
      {
        id: 'offline-image-edit-mock',
        label: 'Offline image edit mock',
        operations: ['image.edit'],
      },
    ],
    modelSelection: 'registry',
  },
];

export function getProviderMetadata(
  providerId: string,
  registry: ProviderMetadata[] = defaultProviderRegistry,
): ProviderMetadata | undefined {
  return registry.find(provider => provider.id === providerId);
}

export function providerCapabilityLabels(
  provider: Pick<ProviderMetadata, 'operations' | 'capabilityLabels'>,
): string[] {
  if (provider.capabilityLabels?.length) {
    return [...provider.capabilityLabels];
  }
  return provider.operations.map(operation => operationLabels[operation]);
}

export function providerConfigsFromRegistry(
  registry: ProviderMetadata[] = defaultProviderRegistry,
): ProviderConfig[] {
  return registry.map(provider => ({
    id: provider.id,
    name: provider.name,
    enabled: false,
    status: 'disabled',
    model: '',
    credentialEnvVar: provider.credential.envVar,
    credentialState: provider.credential.required ? 'missing' : 'not-required',
    capabilities: providerCapabilityLabels(provider),
    costEstimateAvailability: provider.cost.estimateAvailability,
    rateLimitStatus: provider.rateLimit.status,
    requiresPaidJobConfirmation: provider.cost.confirmationPolicy !== 'none',
    expensiveJobThresholdUsd: provider.cost.expensiveJobThresholdUsd,
  }));
}
