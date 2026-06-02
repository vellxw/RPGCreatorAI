import { describe, expect, it } from 'vitest';
import type { ProviderConfig } from '../../types/project';
import { defaultModelCapabilityRegistry } from '../modelCapabilityRegistry';
import {
  buildOpenAiImageGenerationInput,
  defaultOpenAiImageGenerationSettings,
  imageGenerationReadiness,
  normalizeImageGenerationSettings,
  openAiImageGenerationOptions,
} from '../providerImageGenerationSettings';

function openAiProvider(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    id: 'openai',
    name: 'OpenAI',
    enabled: true,
    status: 'configured',
    model: 'gpt-image-2',
    credentialEnvVar: 'OPENAI_API_KEY',
    credentialState: 'configured',
    capabilities: ['Text generation', 'Image generation', 'Image editing'],
    ...overrides,
  };
}

describe('providerImageGenerationSettings', () => {
  it('captures current GPT Image defaults without storing a secret or live endpoint', () => {
    expect(defaultOpenAiImageGenerationSettings).toMatchObject({
      modelId: 'gpt-image-2',
      quality: 'auto',
      size: 'auto',
      outputFormat: 'png',
      background: 'auto',
      moderation: 'auto',
      style: 'project-default',
      styleIsApiParameter: false,
      docsCheckedAt: '2026-06-02',
    });
    expect(JSON.stringify(defaultOpenAiImageGenerationSettings)).not.toMatch(/apiKey|OPENAI_API_KEY|https:\/\/api/i);
  });

  it('exposes only documented API options and keeps style as prompt guidance', () => {
    expect(openAiImageGenerationOptions.qualities).toEqual(['auto', 'low', 'medium', 'high']);
    expect(openAiImageGenerationOptions.sizes).toContain('3840x2160');
    expect(openAiImageGenerationOptions.outputFormats).toEqual(['png', 'webp', 'jpeg']);
    expect(openAiImageGenerationOptions.backgrounds).toEqual(['auto', 'opaque']);
    expect(openAiImageGenerationOptions.styles).toContain('pixel-art');

    const input = buildOpenAiImageGenerationInput({
      ...defaultOpenAiImageGenerationSettings,
      quality: 'high',
      size: '1024x1024',
      style: 'pixel-art',
      outputFormat: 'webp',
      outputCompression: 85,
    });

    expect(input).toEqual({
      model: 'gpt-image-2',
      quality: 'high',
      size: '1024x1024',
      output_format: 'webp',
      output_compression: 85,
      background: 'auto',
      moderation: 'auto',
    });
    expect(input).not.toHaveProperty('style');
  });

  it('normalizes invalid saved settings back to documented safe values', () => {
    expect(normalizeImageGenerationSettings({
      modelId: 'gpt-image-2',
      quality: 'extreme',
      size: '9999x9999',
      style: 'copy-famous-studio',
      outputFormat: 'gif',
      outputCompression: -10,
      background: 'transparent',
      moderation: 'off',
    })).toEqual(defaultOpenAiImageGenerationSettings);
  });

  it('gates image generation on provider enablement, credentials, and model capability', () => {
    expect(imageGenerationReadiness(openAiProvider({ enabled: false, status: 'disabled' }))).toMatchObject({
      state: 'disabled',
      canGenerate: false,
    });
    expect(imageGenerationReadiness(openAiProvider({ credentialState: 'missing', status: 'missing-credentials' }))).toMatchObject({
      state: 'missing-credentials',
      canGenerate: false,
    });
    expect(imageGenerationReadiness(openAiProvider({ model: 'unknown-image-model' }), defaultModelCapabilityRegistry)).toMatchObject({
      state: 'unsupported-model',
      canGenerate: false,
    });
    expect(imageGenerationReadiness(openAiProvider(), defaultModelCapabilityRegistry)).toMatchObject({
      state: 'ready',
      canGenerate: true,
      modelId: 'gpt-image-2',
    });
  });
});
