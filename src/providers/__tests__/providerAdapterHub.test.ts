import { describe, expect, it, vi } from 'vitest';
import { buildProviderCapabilityGates } from '../modelCapabilityRegistry';
import type { ProviderAdapterRequest } from '../providerAdapter';
import { createProviderAdapterHub } from '../providerAdapterHub';
import { defaultProviderRegistry, providerConfigsFromRegistry } from '../providerRegistry';
import { providerContractReadiness } from '../mockProviderContract';

function request(
  providerId: string,
  operation: ProviderAdapterRequest['operation'],
  modelId: string,
  input: Record<string, unknown> = {},
): ProviderAdapterRequest {
  return {
    id: `${providerId}-hub-request`,
    operation,
    providerId,
    modelId,
    prompt: 'Draft a safe provider hub fixture.',
    createdAt: '2026-06-04T07:00:00.000Z',
    input,
  };
}

describe('providerAdapterHub', () => {
  it('constructs one shared adapter surface for every provider in the registry', async () => {
    const fetch = vi.fn();
    const hub = createProviderAdapterHub({
      fetch,
      credentialResolver: async () => 'fixture-provider-secret',
      customEndpoint: {
        baseUrl: 'http://localhost:11434/v1',
        modelId: 'local-rpg-model',
        capabilities: ['text', 'structured-json', 'code'],
      },
      workspaceRoot: 'C:/Users/franc/OneDrive/Escritorio/RPGCreatorAI',
    });

    expect(hub.listProviderIds()).toEqual(defaultProviderRegistry.map(provider => provider.id));

    for (const metadata of defaultProviderRegistry) {
      const adapter = hub.getAdapter(metadata.id);
      expect(adapter?.metadata.id).toBe(metadata.id);
      await expect(adapter!.discoverCapabilities()).resolves.toEqual(metadata.operations);
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps disabled providers out of contract execution and workflow gates', () => {
    const providers = providerConfigsFromRegistry();

    expect(providers).not.toHaveLength(0);
    expect(providers.every(provider => provider.enabled === false)).toBe(true);
    expect(providers.every(provider => providerContractReadiness(provider).state === 'disabled')).toBe(true);
    expect(buildProviderCapabilityGates(providers).every(gate => gate.available === false)).toBe(true);
    expect(JSON.stringify(providers)).not.toMatch(/apiKey|fixture-provider-secret|sk-/i);
  });

  it('fails closed for credentialed adapters without calling live HTTP', async () => {
    const fetch = vi.fn();
    const hub = createProviderAdapterHub({
      fetch,
      credentialResolver: async () => null,
      customEndpoint: {
        baseUrl: 'http://localhost:11434/v1',
        modelId: 'local-rpg-model',
        capabilities: ['text', 'code'],
      },
      workspaceRoot: 'C:/Users/franc/OneDrive/Escritorio/RPGCreatorAI',
    });

    const credentialedRequests = [
      request('openai', 'text.generate', 'gpt-5.5'),
      request('anthropic', 'text.generate', 'claude-sonnet-4-6'),
      request('moonshot', 'text.generate', 'kimi-k2.6'),
      request('deepseek', 'text.generate', 'deepseek-v4-flash'),
      request('minimax', 'text.generate', 'MiniMax-M3'),
      request('custom', 'text.generate', 'local-rpg-model'),
    ];

    for (const item of credentialedRequests) {
      await expect(hub.getAdapter(item.providerId)!.execute(item)).resolves.toMatchObject({
        status: 'failed',
        failure: {
          kind: 'missing-credentials',
        },
      });
    }

    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps local and OpenCode adapters offline and non-mutating through the hub', async () => {
    const hub = createProviderAdapterHub({
      workspaceRoot: 'C:/Users/franc/OneDrive/Escritorio/RPGCreatorAI',
    });

    await expect(hub.getAdapter('local')!.execute(
      request('local', 'text.generate', 'offline-mock'),
    )).resolves.toMatchObject({
      status: 'succeeded',
      output: {
        text: expect.stringContaining('Offline mock response'),
      },
    });

    await expect(hub.getAdapter('opencode')!.execute(
      request('opencode', 'code.assist', 'opencode-workflow', {
        cwd: 'C:/Users/franc/OneDrive/Escritorio/RPGCreatorAI',
      }),
    )).resolves.toMatchObject({
      status: 'succeeded',
      output: {
        data: {
          workflow: 'opencode',
          execution: 'not-started',
          mutationAllowed: false,
        },
      },
    });
  });
});
