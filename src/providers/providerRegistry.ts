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

export interface ProviderMetadata {
  id: string;
  name: string;
  adapterKind: ProviderAdapterKind;
  credential: ProviderCredentialMetadata;
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

export const defaultProviderRegistry: ProviderMetadata[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    adapterKind: 'official-api',
    credential: { required: true, envVar: 'OPENAI_API_KEY' },
    operations: ['text.generate', 'image.generate', 'image.edit', 'vision.analyze'],
    models: [],
    modelSelection: 'user-selected',
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    adapterKind: 'official-api',
    credential: { required: true, envVar: 'ANTHROPIC_API_KEY' },
    operations: ['text.generate', 'code.assist'],
    capabilityLabels: ['Text generation', 'Code assistance', 'Planning'],
    models: [],
    modelSelection: 'user-selected',
  },
  {
    id: 'moonshot',
    name: 'Kimi / Moonshot',
    adapterKind: 'openai-compatible',
    credential: { required: true, envVar: 'MOONSHOT_API_KEY' },
    operations: ['text.generate', 'code.assist'],
    capabilityLabels: ['Text generation', 'Code assistance', 'OpenAI-compatible endpoint'],
    models: [],
    modelSelection: 'user-selected',
    baseUrl: { configurable: true, defaultValue: 'https://api.moonshot.ai/v1' },
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    adapterKind: 'openai-compatible',
    credential: { required: true, envVar: 'DEEPSEEK_API_KEY' },
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
    operations: ['text.generate', 'image.generate', 'video.generate', 'audio.generate'],
    models: [],
    modelSelection: 'user-selected',
  },
  {
    id: 'opencode',
    name: 'OpenCode adapter',
    adapterKind: 'external-tool',
    credential: { required: false },
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
    operations: ['text.generate'],
    capabilityLabels: ['Offline mock contracts'],
    models: [
      {
        id: 'offline-mock',
        label: 'Offline mock',
        operations: ['text.generate'],
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
  }));
}
