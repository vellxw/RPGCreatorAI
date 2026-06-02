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

  it('declares documented image model options without making them required defaults', () => {
    const openai = getProviderMetadata('openai');
    const local = getProviderMetadata('local');

    expect(openai?.modelSelection).toBe('user-selected');
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
