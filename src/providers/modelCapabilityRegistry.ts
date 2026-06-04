import type { ProviderConfig } from '../types/project';
import type { ProviderOperation } from './providerRegistry';

export type ModelCapability =
  | 'text'
  | 'structured-json'
  | 'image'
  | 'image-edit'
  | 'vision'
  | 'audio'
  | 'video'
  | 'code'
  | 'tool';

export interface ModelCapabilityLimits {
  inputFileTypes?: string[];
  outputFileTypes?: string[];
  maxImages?: number;
  maxOutputTokens?: number;
  contextWindowTokens?: number;
  supportsStreaming?: boolean;
}

export interface ModelCapabilityDescriptor {
  providerId: string;
  modelId: string;
  label: string;
  capabilities: ModelCapability[];
  operations: ProviderOperation[];
  limits: ModelCapabilityLimits;
  contextHints?: string[];
}

export interface ProviderWorkflowDefinition {
  id: string;
  label: string;
  requiredCapability: ModelCapability;
}

export interface ProviderCapabilityGate {
  id: string;
  label: string;
  requiredCapability: ModelCapability;
  available: boolean;
  providerId?: string;
  providerName?: string;
  modelId?: string;
  reason: string;
}

export const providerWorkflowDefinitions: ProviderWorkflowDefinition[] = [
  { id: 'text-draft', label: 'Text draft', requiredCapability: 'text' },
  { id: 'structured-json', label: 'Structured JSON', requiredCapability: 'structured-json' },
  { id: 'image-generation', label: 'Image generation', requiredCapability: 'image' },
  { id: 'image-edit', label: 'Image edit', requiredCapability: 'image-edit' },
  { id: 'animation-draft', label: 'Animation draft', requiredCapability: 'video' },
  { id: 'code-tooling', label: 'Code/tooling', requiredCapability: 'code' },
];

export const defaultModelCapabilityRegistry: ModelCapabilityDescriptor[] = [
  {
    providerId: 'openai',
    modelId: 'gpt-5.5',
    label: 'GPT-5.5',
    capabilities: ['text', 'structured-json', 'vision', 'tool'],
    operations: ['text.generate', 'vision.analyze'],
    limits: {
      contextWindowTokens: 1050000,
      maxOutputTokens: 128000,
      supportsStreaming: false,
      maxImages: 8,
      inputFileTypes: ['image/png', 'image/jpeg', 'image/webp'],
      outputFileTypes: [],
    },
    contextHints: ['OpenAI Responses API model for text and vision workflows; credentials are required before use'],
  },
  {
    providerId: 'openai',
    modelId: 'gpt-image-2',
    label: 'GPT Image 2',
    capabilities: ['image', 'image-edit', 'vision'],
    operations: ['image.generate', 'image.edit'],
    limits: {
      inputFileTypes: ['image/png', 'image/jpeg', 'image/webp'],
      outputFileTypes: ['image/png', 'image/webp', 'image/jpeg'],
      maxImages: 1,
      supportsStreaming: false,
    },
    contextHints: ['OpenAI image model settings are configurable and require credentials before use'],
  },
  {
    providerId: 'anthropic',
    modelId: 'claude-opus-4-8',
    label: 'Claude Opus 4.8',
    capabilities: ['text', 'structured-json', 'code', 'tool'],
    operations: ['text.generate', 'code.assist'],
    limits: {
      contextWindowTokens: 1000000,
      maxOutputTokens: 128000,
      supportsStreaming: false,
      maxImages: 8,
      inputFileTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
      outputFileTypes: [],
    },
    contextHints: ['Anthropic Messages API model for complex text, structured authoring, and code assistance'],
  },
  {
    providerId: 'anthropic',
    modelId: 'claude-sonnet-4-6',
    label: 'Claude Sonnet 4.6',
    capabilities: ['text', 'structured-json', 'code', 'tool'],
    operations: ['text.generate', 'code.assist'],
    limits: {
      contextWindowTokens: 1000000,
      maxOutputTokens: 64000,
      supportsStreaming: false,
      maxImages: 8,
      inputFileTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
      outputFileTypes: [],
    },
    contextHints: ['Anthropic Messages API model for balanced text, structured authoring, and code assistance'],
  },
  {
    providerId: 'anthropic',
    modelId: 'claude-haiku-4-5-20251001',
    label: 'Claude Haiku 4.5',
    capabilities: ['text', 'structured-json', 'code', 'tool'],
    operations: ['text.generate', 'code.assist'],
    limits: {
      contextWindowTokens: 200000,
      maxOutputTokens: 64000,
      supportsStreaming: false,
      maxImages: 8,
      inputFileTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
      outputFileTypes: [],
    },
    contextHints: ['Anthropic Messages API model for fast text, structured authoring, and code assistance'],
  },
  {
    providerId: 'moonshot',
    modelId: 'kimi-k2.6',
    label: 'Kimi K2.6',
    capabilities: ['text', 'structured-json', 'code', 'tool'],
    operations: ['text.generate', 'code.assist'],
    limits: {
      contextWindowTokens: 256000,
      maxOutputTokens: 32768,
      supportsStreaming: false,
      inputFileTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4'],
      outputFileTypes: [],
    },
    contextHints: ['Kimi OpenAI-compatible chat completions model for text, structured authoring, and code workflows'],
  },
  {
    providerId: 'moonshot',
    modelId: 'kimi-k2.5',
    label: 'Kimi K2.5',
    capabilities: ['text', 'structured-json', 'code', 'tool'],
    operations: ['text.generate', 'code.assist'],
    limits: {
      contextWindowTokens: 256000,
      maxOutputTokens: 32768,
      supportsStreaming: false,
      inputFileTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4'],
      outputFileTypes: [],
    },
    contextHints: ['Kimi OpenAI-compatible chat completions model for text, structured authoring, and code workflows'],
  },
  {
    providerId: 'moonshot',
    modelId: 'moonshot-v1-128k',
    label: 'Moonshot v1 128k',
    capabilities: ['text', 'structured-json'],
    operations: ['text.generate'],
    limits: {
      contextWindowTokens: 128000,
      supportsStreaming: false,
    },
    contextHints: ['Moonshot v1 OpenAI-compatible long-context text model'],
  },
  {
    providerId: 'moonshot',
    modelId: 'moonshot-v1-32k',
    label: 'Moonshot v1 32k',
    capabilities: ['text', 'structured-json'],
    operations: ['text.generate'],
    limits: {
      contextWindowTokens: 32000,
      supportsStreaming: false,
    },
    contextHints: ['Moonshot v1 OpenAI-compatible text model'],
  },
  {
    providerId: 'moonshot',
    modelId: 'moonshot-v1-8k',
    label: 'Moonshot v1 8k',
    capabilities: ['text', 'structured-json'],
    operations: ['text.generate'],
    limits: {
      contextWindowTokens: 8000,
      supportsStreaming: false,
    },
    contextHints: ['Moonshot v1 OpenAI-compatible text model'],
  },
  {
    providerId: 'deepseek',
    modelId: 'deepseek-v4-flash',
    label: 'DeepSeek V4 Flash',
    capabilities: ['text', 'structured-json', 'code'],
    operations: ['text.generate', 'code.assist'],
    limits: {
      maxOutputTokens: 32768,
      supportsStreaming: false,
    },
    contextHints: ['DeepSeek OpenAI-compatible chat completions model for text, JSON, and code workflows'],
  },
  {
    providerId: 'deepseek',
    modelId: 'deepseek-v4-pro',
    label: 'DeepSeek V4 Pro',
    capabilities: ['text', 'structured-json', 'code'],
    operations: ['text.generate', 'code.assist'],
    limits: {
      maxOutputTokens: 32768,
      supportsStreaming: false,
    },
    contextHints: ['DeepSeek OpenAI-compatible chat completions model for text, JSON, and code workflows'],
  },
  {
    providerId: 'deepseek',
    modelId: 'deepseek-chat',
    label: 'DeepSeek Chat',
    capabilities: ['text', 'structured-json', 'code'],
    operations: ['text.generate', 'code.assist'],
    limits: {
      maxOutputTokens: 32768,
      supportsStreaming: false,
    },
    contextHints: ['Compatibility alias scheduled for future deprecation; prefer deepseek-v4-flash when possible'],
  },
  {
    providerId: 'deepseek',
    modelId: 'deepseek-reasoner',
    label: 'DeepSeek Reasoner',
    capabilities: ['text', 'structured-json', 'code'],
    operations: ['text.generate', 'code.assist'],
    limits: {
      maxOutputTokens: 64000,
      supportsStreaming: false,
    },
    contextHints: ['Reasoning compatibility alias scheduled for future deprecation; prefer current v4 models when possible'],
  },
  {
    providerId: 'minimax',
    modelId: 'MiniMax-M3',
    label: 'MiniMax M3',
    capabilities: ['text', 'structured-json', 'code', 'tool', 'vision'],
    operations: ['text.generate'],
    limits: {
      contextWindowTokens: 1000000,
      supportsStreaming: false,
      maxImages: 8,
      inputFileTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime'],
      outputFileTypes: [],
    },
    contextHints: ['MiniMax OpenAI-compatible chat model for text and multimodal input; output workflows remain text-only here'],
  },
  {
    providerId: 'minimax',
    modelId: 'MiniMax-M2.7',
    label: 'MiniMax M2.7',
    capabilities: ['text', 'structured-json', 'code', 'tool'],
    operations: ['text.generate'],
    limits: {
      contextWindowTokens: 204800,
      supportsStreaming: false,
    },
    contextHints: ['MiniMax OpenAI-compatible text model for structured authoring and code-adjacent prompts'],
  },
  {
    providerId: 'minimax',
    modelId: 'MiniMax-M2.7-highspeed',
    label: 'MiniMax M2.7 Highspeed',
    capabilities: ['text', 'structured-json', 'code', 'tool'],
    operations: ['text.generate'],
    limits: {
      contextWindowTokens: 204800,
      supportsStreaming: false,
    },
    contextHints: ['MiniMax highspeed text model for faster authoring prompts'],
  },
  {
    providerId: 'minimax',
    modelId: 'image-01',
    label: 'MiniMax Image 01',
    capabilities: ['image'],
    operations: ['image.generate'],
    limits: {
      outputFileTypes: ['image/jpeg'],
      maxImages: 9,
      supportsStreaming: false,
    },
    contextHints: ['MiniMax image generation model for text-to-image and subject-reference image generation'],
  },
  {
    providerId: 'opencode',
    modelId: 'opencode-workflow',
    label: 'OpenCode controlled workflow',
    capabilities: ['code', 'tool'],
    operations: ['code.assist'],
    limits: {
      inputFileTypes: [],
      outputFileTypes: [],
      supportsStreaming: false,
    },
    contextHints: [
      'Offline handoff descriptor for OpenCode CLI workflows; adapter prepares controlled prompts and never executes external tools directly',
    ],
  },
  {
    providerId: 'local',
    modelId: 'offline-mock',
    label: 'Offline mock',
    capabilities: ['text'],
    operations: ['text.generate'],
    limits: {
      contextWindowTokens: 4000,
      maxOutputTokens: 1000,
      supportsStreaming: false,
      maxImages: 0,
      inputFileTypes: [],
      outputFileTypes: [],
    },
    contextHints: ['Offline fixture responses only'],
  },
  {
    providerId: 'local',
    modelId: 'offline-image-mock',
    label: 'Offline image mock',
    capabilities: ['image'],
    operations: ['image.generate'],
    limits: {
      inputFileTypes: [],
      outputFileTypes: ['image/png'],
      maxImages: 1,
      supportsStreaming: false,
    },
    contextHints: ['Offline image fixture responses only'],
  },
  {
    providerId: 'local',
    modelId: 'offline-image-edit-mock',
    label: 'Offline image edit mock',
    capabilities: ['image-edit'],
    operations: ['image.edit'],
    limits: {
      inputFileTypes: ['image/png', 'image/jpeg', 'image/webp'],
      outputFileTypes: ['image/png'],
      maxImages: 1,
      supportsStreaming: false,
    },
    contextHints: ['Offline image edit fixture responses only'],
  },
];

export function getModelCapabilityDescriptor(
  providerId: string,
  modelId: string,
  registry: ModelCapabilityDescriptor[] = defaultModelCapabilityRegistry,
): ModelCapabilityDescriptor | undefined {
  return registry.find(model => model.providerId === providerId && model.modelId === modelId);
}

export function modelSupportsCapability(
  descriptor: ModelCapabilityDescriptor,
  capability: ModelCapability,
): boolean {
  return descriptor.capabilities.includes(capability);
}

function providerCanRoute(provider: ProviderConfig): boolean {
  return provider.enabled &&
    (provider.credentialState === 'configured' || provider.credentialState === 'not-required') &&
    (provider.model.trim().length > 0 || provider.id === 'opencode');
}

function routableDescriptorsForProvider(
  provider: ProviderConfig,
  registry: ModelCapabilityDescriptor[],
): ModelCapabilityDescriptor[] {
  const selectedModel = provider.model.trim();
  if (selectedModel.length > 0) {
    const descriptor = getModelCapabilityDescriptor(provider.id, selectedModel, registry);
    return descriptor ? [descriptor] : [];
  }

  if (provider.id === 'opencode' && provider.credentialState === 'not-required') {
    const workflowDescriptor = getModelCapabilityDescriptor(provider.id, 'opencode-workflow', registry);
    return workflowDescriptor ? [workflowDescriptor] : [];
  }

  return [];
}

export function buildProviderCapabilityGates(
  providers: ProviderConfig[],
  registry: ModelCapabilityDescriptor[] = defaultModelCapabilityRegistry,
  workflows: ProviderWorkflowDefinition[] = providerWorkflowDefinitions,
): ProviderCapabilityGate[] {
  return workflows.map(workflow => {
    for (const provider of providers) {
      if (!providerCanRoute(provider)) continue;
      for (const descriptor of routableDescriptorsForProvider(provider, registry)) {
        if (!modelSupportsCapability(descriptor, workflow.requiredCapability)) continue;
        return {
          id: workflow.id,
          label: workflow.label,
          requiredCapability: workflow.requiredCapability,
          available: true,
          providerId: provider.id,
          providerName: provider.name,
          modelId: descriptor.modelId,
          reason: `${provider.name} / ${descriptor.label}`,
        };
      }
    }

    return {
      id: workflow.id,
      label: workflow.label,
      requiredCapability: workflow.requiredCapability,
      available: false,
      reason: 'No configured model declares this capability.',
    };
  });
}
