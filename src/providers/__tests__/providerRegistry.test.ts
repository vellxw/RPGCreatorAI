import { describe, expect, it } from 'vitest';
import {
  defaultProviderRegistry,
  getProviderMetadata,
  providerConfigsFromRegistry,
  type ProviderOperation,
} from '../providerRegistry';

describe('providerRegistry', () => {
  it('defines metadata for every default provider without required model ids', () => {
    const ids = defaultProviderRegistry.map(provider => provider.id);

    expect(ids).toEqual([
      'openai',
      'anthropic',
      'moonshot',
      'deepseek',
      'minimax',
      'opencode',
      'custom',
      'local',
    ]);
    expect(defaultProviderRegistry.every(provider => provider.operations.length > 0)).toBe(true);
    expect(defaultProviderRegistry.every(provider => provider.modelSelection !== 'required-default')).toBe(true);
    expect(getProviderMetadata('openai')?.credential.envVar).toBe('OPENAI_API_KEY');
    expect(getProviderMetadata('local')?.credential.required).toBe(false);
  });

  it('declares documented OpenAI model options without making them required defaults', () => {
    const openai = getProviderMetadata('openai');
    const local = getProviderMetadata('local');

    expect(openai?.modelSelection).toBe('user-selected');
    expect(openai?.models).toContainEqual({
      id: 'gpt-5.5',
      label: 'GPT-5.5',
      operations: ['text.generate', 'vision.analyze'],
    });
    expect(openai?.models).toContainEqual({
      id: 'gpt-image-2',
      label: 'GPT Image 2',
      operations: ['image.generate', 'image.edit'],
    });
    expect(local?.models).toContainEqual({
      id: 'offline-image-mock',
      label: 'Offline image mock',
      operations: ['image.generate'],
    });
    expect(local?.models).toContainEqual({
      id: 'offline-image-edit-mock',
      label: 'Offline image edit mock',
      operations: ['image.edit'],
    });
  });

  it('declares documented Claude model options without making them required defaults', () => {
    const anthropic = getProviderMetadata('anthropic');

    expect(anthropic?.modelSelection).toBe('user-selected');
    expect(anthropic?.models).toEqual([
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
    ]);
  });

  it('declares documented Kimi model options with configurable base URL', () => {
    const moonshot = getProviderMetadata('moonshot');

    expect(moonshot?.adapterKind).toBe('openai-compatible');
    expect(moonshot?.modelSelection).toBe('user-selected');
    expect(moonshot?.baseUrl).toEqual({
      configurable: true,
      defaultValue: 'https://api.moonshot.ai/v1',
    });
    expect(moonshot?.models).toEqual([
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
    ]);
  });

  it('declares documented DeepSeek model options with configurable base URL', () => {
    const deepseek = getProviderMetadata('deepseek');

    expect(deepseek?.adapterKind).toBe('openai-compatible');
    expect(deepseek?.modelSelection).toBe('user-selected');
    expect(deepseek?.baseUrl).toEqual({
      configurable: true,
      defaultValue: 'https://api.deepseek.com',
    });
    expect(deepseek?.models).toEqual([
      {
        id: 'deepseek-v4-flash',
        label: 'DeepSeek V4 Flash',
        operations: ['text.generate', 'code.assist'],
      },
      {
        id: 'deepseek-v4-pro',
        label: 'DeepSeek V4 Pro',
        operations: ['text.generate', 'code.assist'],
      },
      {
        id: 'deepseek-chat',
        label: 'DeepSeek Chat',
        operations: ['text.generate', 'code.assist'],
      },
      {
        id: 'deepseek-reasoner',
        label: 'DeepSeek Reasoner',
        operations: ['text.generate', 'code.assist'],
      },
    ]);
  });

  it('derives settings provider configs from registry metadata', () => {
    const configs = providerConfigsFromRegistry(defaultProviderRegistry);
    const openai = configs.find(provider => provider.id === 'openai');
    const local = configs.find(provider => provider.id === 'local');

    expect(openai).toMatchObject({
      name: 'OpenAI',
      enabled: false,
      model: '',
      credentialEnvVar: 'OPENAI_API_KEY',
      credentialState: 'missing',
    });
    expect(openai?.capabilities).toContain('Text generation');
    expect(openai?.capabilities).toContain('Image editing');
    expect(openai?.model).toBe('');
    expect(local).toMatchObject({
      name: 'Local gateway',
      credentialState: 'not-required',
    });
    expect(configs.every(provider => !Object.prototype.hasOwnProperty.call(provider, 'apiKey'))).toBe(true);
  });

  it('keeps operation identifiers data-driven and stable', () => {
    const operations = new Set<ProviderOperation>();
    for (const provider of defaultProviderRegistry) {
      provider.operations.forEach(operation => operations.add(operation));
    }

    expect([...operations].sort()).toEqual([
      'audio.generate',
      'code.assist',
      'image.edit',
      'image.generate',
      'text.generate',
      'video.generate',
      'vision.analyze',
    ]);
  });
});
