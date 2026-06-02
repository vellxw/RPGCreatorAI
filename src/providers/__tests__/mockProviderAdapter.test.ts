import { describe, expect, it } from 'vitest';
import { createMockProviderAdapter } from '../mockProviderAdapter';
import type { ProviderAdapterRequest } from '../providerAdapter';

function textRequest(overrides: Partial<ProviderAdapterRequest> = {}): ProviderAdapterRequest {
  return {
    id: 'request-1',
    operation: 'text.generate',
    providerId: 'local',
    prompt: 'Draft a town inn greeting.',
    modelId: 'offline-mock',
    createdAt: '2026-06-02T13:15:00.000Z',
    ...overrides,
  };
}

describe('mockProviderAdapter', () => {
  it('discovers capabilities and models without live provider calls', async () => {
    const adapter = createMockProviderAdapter();

    await expect(adapter.discoverCapabilities()).resolves.toEqual(['text.generate', 'image.generate', 'image.edit']);
    await expect(adapter.listModels()).resolves.toEqual([
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
    ]);
  });

  it('returns deterministic text responses matching the adapter contract', async () => {
    const adapter = createMockProviderAdapter();
    const result = await adapter.execute(textRequest());

    expect(result).toEqual({
      id: 'request-1',
      operation: 'text.generate',
      providerId: 'local',
      modelId: 'offline-mock',
      status: 'succeeded',
      output: {
        text: expect.stringContaining('Draft a town inn greeting.'),
      },
      usage: {
        inputTokens: 6,
        outputTokens: 12,
      },
    });
  });

  it('reports cancellation through the shared response shape', async () => {
    const adapter = createMockProviderAdapter();
    const controller = new AbortController();
    controller.abort();

    await expect(adapter.execute(textRequest(), { signal: controller.signal })).resolves.toMatchObject({
      id: 'request-1',
      operation: 'text.generate',
      providerId: 'local',
      status: 'cancelled',
      error: 'Request cancelled before execution.',
    });
  });

  it('rejects unsupported operations without mutating project data', async () => {
    const adapter = createMockProviderAdapter();
    const result = await adapter.execute(textRequest({
      operation: 'image.edit',
      prompt: 'Edit a tileset.',
    }));

    expect(result).toMatchObject({
      status: 'failed',
      error: 'Mock model offline-mock does not support image.edit.',
    });
    expect(result.output).toBeUndefined();
  });

  it('returns deterministic image fixture responses without live provider calls', async () => {
    const adapter = createMockProviderAdapter();
    const result = await adapter.execute(textRequest({
      id: 'image-request-1',
      operation: 'image.generate',
      modelId: 'offline-image-mock',
      prompt: 'Create a 16 color town icon.',
      input: {
        quality: 'low',
        size: '1024x1024',
        outputFormat: 'png',
      },
    }));

    expect(result).toEqual({
      id: 'image-request-1',
      operation: 'image.generate',
      providerId: 'local',
      modelId: 'offline-image-mock',
      status: 'succeeded',
      output: {
        assetRefs: ['mock://generated/image-request-1.png'],
        data: {
          mimeType: 'image/png',
          revisedPrompt: 'Create a 16 color town icon.',
          fixture: 'offline-image',
          size: '1024x1024',
          quality: 'low',
        },
      },
      usage: {
        inputTokens: 7,
        imageCount: 1,
        outputTokens: 196,
      },
    });
  });

  it('returns deterministic image edit fixture responses without live provider calls', async () => {
    const adapter = createMockProviderAdapter();
    const result = await adapter.execute(textRequest({
      id: 'image-edit-request-1',
      operation: 'image.edit',
      modelId: 'offline-image-edit-mock',
      prompt: 'Create a dusk variation while preserving composition.',
      input: {
        sourceAssetId: 'forest_concept',
        sourceAssetPath: 'assets/imported/images/forest_concept.png',
        mode: 'variation',
        quality: 'low',
        size: '1536x1024',
        outputFormat: 'png',
      },
    }));

    expect(result).toEqual({
      id: 'image-edit-request-1',
      operation: 'image.edit',
      providerId: 'local',
      modelId: 'offline-image-edit-mock',
      status: 'succeeded',
      output: {
        assetRefs: ['mock://generated/image-edit-request-1.png'],
        data: {
          mimeType: 'image/png',
          revisedPrompt: 'Create a dusk variation while preserving composition.',
          fixture: 'offline-image-edit',
          sourceAssetId: 'forest_concept',
          mode: 'variation',
          size: '1536x1024',
          quality: 'low',
        },
      },
      usage: {
        inputTokens: 8,
        imageCount: 1,
        outputTokens: 196,
      },
    });
  });

  it('reports fixture rate-limit and quota failures with retry guidance', async () => {
    const adapter = createMockProviderAdapter();

    await expect(adapter.execute(textRequest({
      id: 'rate-limit-1',
      input: { fixtureFailure: 'rate-limit', retryAfterSeconds: 90 },
    }))).resolves.toMatchObject({
      status: 'failed',
      failure: {
        kind: 'rate-limit',
        retryAfterSeconds: 90,
        retryGuidance: 'Wait 90 seconds before retrying this provider request.',
      },
    });

    await expect(adapter.execute(textRequest({
      id: 'quota-1',
      input: { fixtureFailure: 'quota-exceeded' },
    }))).resolves.toMatchObject({
      status: 'failed',
      failure: {
        kind: 'quota-exceeded',
        retryGuidance: 'Review provider quota or budget settings before retrying.',
      },
    });
  });
});
