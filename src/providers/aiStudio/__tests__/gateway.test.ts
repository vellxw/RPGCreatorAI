import { describe, expect, it } from 'vitest';
import type { ProviderAdapter, ProviderAdapterResponse } from '../../providerAdapter';
import { getProviderMetadata } from '../../providerRegistry';
import { createAiStudioGenerationGateway } from '../gateway';

const NOW = '2026-08-14T12:00:00.000Z';

describe('AI Studio generation gateway', () => {
  it('generates deterministic text and image fixtures offline by default', async () => {
    const gateway = createAiStudioGenerationGateway({ now: () => NOW });

    const text = await gateway.generateText({
      id: 'offline-text-1',
      prompt: 'Draft a warning from the abandoned chapel.',
    });
    const image = await gateway.generateImage({
      id: 'offline-image-1',
      prompt: 'A rain-soaked chapel portrait in pixel art.',
      parameters: { outputFormat: 'png', quality: 'low', size: '1024x1024' },
    });

    expect(text).toMatchObject({
      status: 'succeeded',
      generationKind: 'text',
      requestId: 'offline-text-1',
      provenance: {
        providerId: 'local',
        modelId: 'offline-mock',
        mode: 'offline',
        createdAt: NOW,
      },
      output: { text: expect.stringContaining('abandoned chapel') },
    });
    expect(image).toMatchObject({
      status: 'succeeded',
      generationKind: 'image',
      requestId: 'offline-image-1',
      provenance: {
        providerId: 'local',
        modelId: 'offline-image-mock',
        mode: 'offline',
      },
      output: { assetRefs: ['mock://generated/offline-image-1.png'] },
    });
  });

  it('redacts credential-shaped prompt and context values before the mock sees them', async () => {
    const gateway = createAiStudioGenerationGateway({ now: () => NOW });
    const secret = 'sk-offline-secret-123456';

    const result = await gateway.generateText({
      id: 'redacted-text-1',
      prompt: `Draft dialogue. api_key=${secret}`,
      context: { authorization: `Bearer ${secret}` },
    });

    expect(result.status).toBe('succeeded');
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(JSON.stringify(result)).toContain('[REDACTED]');
  });

  it('keeps cancellation authoritative when an injected adapter ignores AbortSignal', async () => {
    const metadata = getProviderMetadata('openai');
    if (!metadata) throw new Error('OpenAI metadata fixture is missing.');

    let resolveProvider!: (response: ProviderAdapterResponse) => void;
    const adapter: ProviderAdapter = {
      metadata,
      discoverCapabilities: async () => [...metadata.operations],
      listModels: async () => metadata.models,
      execute: request => new Promise(resolve => {
        resolveProvider = resolve;
      }),
    };
    const gateway = createAiStudioGenerationGateway({
      now: () => NOW,
      resolveAdapter: providerId => providerId === 'openai' ? adapter : undefined,
    });
    const controller = new AbortController();
    const pending = gateway.generateImage({
      id: 'ignored-abort-1',
      prompt: 'Generate a portrait that must be cancelled.',
      target: { providerId: 'openai', modelId: 'gpt-image-2' },
    }, { signal: controller.signal });

    controller.abort();
    resolveProvider({
      id: 'ignored-abort-1',
      operation: 'image.generate',
      providerId: 'openai',
      modelId: 'gpt-image-2',
      status: 'succeeded',
      output: { assetRefs: ['openai://generated/ignored-abort-1/0'] },
    });

    await expect(pending).resolves.toMatchObject({
      status: 'cancelled',
      generationKind: 'image',
      failure: { kind: 'cancelled' },
    });
  });
});
