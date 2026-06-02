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
    provider.model.trim().length > 0;
}

export function buildProviderCapabilityGates(
  providers: ProviderConfig[],
  registry: ModelCapabilityDescriptor[] = defaultModelCapabilityRegistry,
  workflows: ProviderWorkflowDefinition[] = providerWorkflowDefinitions,
): ProviderCapabilityGate[] {
  return workflows.map(workflow => {
    for (const provider of providers) {
      if (!providerCanRoute(provider)) continue;
      const descriptor = getModelCapabilityDescriptor(provider.id, provider.model, registry);
      if (!descriptor || !modelSupportsCapability(descriptor, workflow.requiredCapability)) continue;
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

    return {
      id: workflow.id,
      label: workflow.label,
      requiredCapability: workflow.requiredCapability,
      available: false,
      reason: 'No configured model declares this capability.',
    };
  });
}
