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

    await expect(adapter.discoverCapabilities()).resolves.toEqual(['text.generate']);
    await expect(adapter.listModels()).resolves.toEqual([
      {
        id: 'offline-mock',
        label: 'Offline mock',
        operations: ['text.generate'],
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
      operation: 'image.generate',
      prompt: 'Create a tileset.',
    }));

    expect(result).toMatchObject({
      status: 'failed',
      error: 'Mock provider does not support image.generate.',
    });
    expect(result.output).toBeUndefined();
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
