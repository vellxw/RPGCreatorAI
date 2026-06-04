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
  it('defines GPT-5.5 text and vision capabilities from current OpenAI Responses docs', () => {
    const descriptor = getModelCapabilityDescriptor('openai', 'gpt-5.5');

    expect(descriptor).toMatchObject({
      providerId: 'openai',
      modelId: 'gpt-5.5',
      label: 'GPT-5.5',
      capabilities: ['text', 'structured-json', 'vision', 'tool'],
      operations: ['text.generate', 'vision.analyze'],
      limits: {
        contextWindowTokens: 1050000,
        maxOutputTokens: 128000,
        supportsStreaming: false,
      },
    });
    expect(modelSupportsCapability(descriptor!, 'text')).toBe(true);
    expect(modelSupportsCapability(descriptor!, 'vision')).toBe(true);
    expect(modelSupportsCapability(descriptor!, 'video')).toBe(false);
  });

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

  it('defines Claude text and structured authoring capabilities from current Anthropic docs', () => {
    const opus = getModelCapabilityDescriptor('anthropic', 'claude-opus-4-8');
    const sonnet = getModelCapabilityDescriptor('anthropic', 'claude-sonnet-4-6');
    const haiku = getModelCapabilityDescriptor('anthropic', 'claude-haiku-4-5-20251001');

    expect(opus).toMatchObject({
      providerId: 'anthropic',
      modelId: 'claude-opus-4-8',
      capabilities: ['text', 'structured-json', 'code', 'tool'],
      operations: ['text.generate', 'code.assist'],
      limits: {
        contextWindowTokens: 1000000,
        maxOutputTokens: 128000,
      },
    });
    expect(sonnet).toMatchObject({
      providerId: 'anthropic',
      modelId: 'claude-sonnet-4-6',
      limits: {
        contextWindowTokens: 1000000,
        maxOutputTokens: 64000,
      },
    });
    expect(haiku).toMatchObject({
      providerId: 'anthropic',
      modelId: 'claude-haiku-4-5-20251001',
      limits: {
        contextWindowTokens: 200000,
        maxOutputTokens: 64000,
      },
    });
    expect(modelSupportsCapability(opus!, 'structured-json')).toBe(true);
    expect(modelSupportsCapability(sonnet!, 'code')).toBe(true);
    expect(modelSupportsCapability(haiku!, 'image')).toBe(false);
  });

  it('defines Kimi OpenAI-compatible text and code capabilities from current Moonshot docs', () => {
    const k26 = getModelCapabilityDescriptor('moonshot', 'kimi-k2.6');
    const k25 = getModelCapabilityDescriptor('moonshot', 'kimi-k2.5');
    const v1 = getModelCapabilityDescriptor('moonshot', 'moonshot-v1-128k');

    expect(k26).toMatchObject({
      providerId: 'moonshot',
      modelId: 'kimi-k2.6',
      capabilities: ['text', 'structured-json', 'code', 'tool'],
      operations: ['text.generate', 'code.assist'],
      limits: {
        contextWindowTokens: 256000,
        maxOutputTokens: 32768,
      },
    });
    expect(k25).toMatchObject({
      providerId: 'moonshot',
      modelId: 'kimi-k2.5',
      limits: {
        contextWindowTokens: 256000,
      },
    });
    expect(v1).toMatchObject({
      providerId: 'moonshot',
      modelId: 'moonshot-v1-128k',
      capabilities: ['text', 'structured-json'],
      operations: ['text.generate'],
      limits: {
        contextWindowTokens: 128000,
      },
    });
    expect(modelSupportsCapability(k26!, 'code')).toBe(true);
    expect(modelSupportsCapability(v1!, 'code')).toBe(false);
  });

  it('defines DeepSeek OpenAI-compatible text and code capabilities from current docs', () => {
    const flash = getModelCapabilityDescriptor('deepseek', 'deepseek-v4-flash');
    const pro = getModelCapabilityDescriptor('deepseek', 'deepseek-v4-pro');
    const reasoner = getModelCapabilityDescriptor('deepseek', 'deepseek-reasoner');

    expect(flash).toMatchObject({
      providerId: 'deepseek',
      modelId: 'deepseek-v4-flash',
      capabilities: ['text', 'structured-json', 'code'],
      operations: ['text.generate', 'code.assist'],
      limits: {
        maxOutputTokens: 32768,
      },
    });
    expect(pro).toMatchObject({
      providerId: 'deepseek',
      modelId: 'deepseek-v4-pro',
      capabilities: ['text', 'structured-json', 'code'],
    });
    expect(reasoner).toMatchObject({
      providerId: 'deepseek',
      modelId: 'deepseek-reasoner',
      limits: {
        maxOutputTokens: 64000,
      },
    });
    expect(modelSupportsCapability(flash!, 'structured-json')).toBe(true);
    expect(modelSupportsCapability(pro!, 'code')).toBe(true);
    expect(modelSupportsCapability(reasoner!, 'image')).toBe(false);
  });

  it('defines MiniMax app-supported text and image capabilities from current docs', () => {
    const m3 = getModelCapabilityDescriptor('minimax', 'MiniMax-M3');
    const m27 = getModelCapabilityDescriptor('minimax', 'MiniMax-M2.7');
    const image = getModelCapabilityDescriptor('minimax', 'image-01');

    expect(m3).toMatchObject({
      providerId: 'minimax',
      modelId: 'MiniMax-M3',
      capabilities: ['text', 'structured-json', 'code', 'tool', 'vision'],
      operations: ['text.generate'],
      limits: {
        contextWindowTokens: 1000000,
      },
    });
    expect(m27).toMatchObject({
      providerId: 'minimax',
      modelId: 'MiniMax-M2.7',
      capabilities: ['text', 'structured-json', 'code', 'tool'],
      limits: {
        contextWindowTokens: 204800,
      },
    });
    expect(image).toMatchObject({
      providerId: 'minimax',
      modelId: 'image-01',
      capabilities: ['image'],
      operations: ['image.generate'],
      limits: {
        maxImages: 9,
        outputFileTypes: ['image/jpeg'],
      },
    });
    expect(modelSupportsCapability(m3!, 'video')).toBe(false);
    expect(modelSupportsCapability(image!, 'image-edit')).toBe(false);
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
