import { describe, expect, it } from 'vitest';
import {
  buildProviderCapabilityGates,
  defaultModelCapabilityRegistry,
  getModelCapabilityDescriptor,
  modelSupportsCapability,
  type ModelCapabilityDescriptor,
} from '../modelCapabilityRegistry';
import type { ProviderConfig } from '../../types/project';

const configuredLocal: ProviderConfig = {
  id: 'local',
  name: 'Local gateway',
  enabled: true,
  status: 'configured',
  model: 'offline-mock',
  credentialState: 'not-required',
  capabilities: ['Offline mock contracts'],
};

describe('modelCapabilityRegistry', () => {
  it('defines offline mock model capabilities with limits as data', () => {
    const descriptor = getModelCapabilityDescriptor('local', 'offline-mock');

    expect(descriptor).toMatchObject({
      providerId: 'local',
      modelId: 'offline-mock',
      capabilities: ['text'],
      limits: {
        contextWindowTokens: 4000,
        maxOutputTokens: 1000,
        supportsStreaming: false,
        maxImages: 0,
      },
    });
    expect(modelSupportsCapability(descriptor!, 'text')).toBe(true);
    expect(modelSupportsCapability(descriptor!, 'image')).toBe(false);
  });

  it('defines GPT Image 2 capabilities from current OpenAI image docs', () => {
    const descriptor = getModelCapabilityDescriptor('openai', 'gpt-image-2');

    expect(descriptor).toMatchObject({
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
    });
    expect(modelSupportsCapability(descriptor!, 'image')).toBe(true);
    expect(modelSupportsCapability(descriptor!, 'image-edit')).toBe(true);
    expect(modelSupportsCapability(descriptor!, 'video')).toBe(false);
  });

  it('defines a separate offline image mock capability fixture', () => {
    const descriptor = getModelCapabilityDescriptor('local', 'offline-image-mock');

    expect(descriptor).toMatchObject({
      providerId: 'local',
      modelId: 'offline-image-mock',
      capabilities: ['image'],
      operations: ['image.generate'],
      limits: {
        maxImages: 1,
        outputFileTypes: ['image/png'],
      },
    });
  });

  it('defines a separate offline image edit mock capability fixture', () => {
    const descriptor = getModelCapabilityDescriptor('local', 'offline-image-edit-mock');

    expect(descriptor).toMatchObject({
      providerId: 'local',
      modelId: 'offline-image-edit-mock',
      capabilities: ['image-edit'],
      operations: ['image.edit'],
      limits: {
        maxImages: 1,
        inputFileTypes: ['image/png', 'image/jpeg', 'image/webp'],
        outputFileTypes: ['image/png'],
      },
    });
    expect(modelSupportsCapability(descriptor!, 'image-edit')).toBe(true);
    expect(modelSupportsCapability(descriptor!, 'image')).toBe(false);
  });

  it('keeps unknown real-provider models unavailable until capability data exists', () => {
    expect(getModelCapabilityDescriptor('openai', 'user-entered-model')).toBeUndefined();
  });

  it('drives workflow gates from model capabilities rather than provider names', () => {
    const customImageModel: ModelCapabilityDescriptor = {
      providerId: 'custom',
      modelId: 'custom-image-fixture',
      label: 'Custom image fixture',
      capabilities: ['image'],
      operations: ['image.generate'],
      limits: {
        inputFileTypes: ['image/png'],
        outputFileTypes: ['image/png'],
        maxImages: 4,
        supportsStreaming: false,
      },
    };
    const customProvider: ProviderConfig = {
      id: 'custom',
      name: 'Custom OpenAI-compatible endpoint',
      enabled: true,
      status: 'configured',
      model: 'custom-image-fixture',
      credentialEnvVar: 'CUSTOM_OPENAI_API_KEY',
      credentialState: 'configured',
      capabilities: ['Text generation', 'OpenAI-compatible endpoint'],
    };

    const gates = buildProviderCapabilityGates([configuredLocal, customProvider], [
      ...defaultModelCapabilityRegistry,
      customImageModel,
    ]);

    expect(gates.find(gate => gate.id === 'text-draft')).toMatchObject({
      available: true,
      providerId: 'local',
      modelId: 'offline-mock',
    });
    expect(gates.find(gate => gate.id === 'image-generation')).toMatchObject({
      available: true,
      providerId: 'custom',
      modelId: 'custom-image-fixture',
    });
    expect(gates.find(gate => gate.id === 'image-edit')).toMatchObject({
      available: false,
    });
  });
});
