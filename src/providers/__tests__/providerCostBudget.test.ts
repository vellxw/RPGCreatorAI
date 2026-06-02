import { describe, expect, it } from 'vitest';
import { buildProviderCostBudgetStates } from '../providerCostBudget';
import { defaultProviderRegistry } from '../providerRegistry';
import type { ProviderConfig } from '../../types/project';

const configuredOpenAi: ProviderConfig = {
  id: 'openai',
  name: 'OpenAI',
  enabled: true,
  status: 'configured',
  model: 'user-selected-model',
  credentialEnvVar: 'OPENAI_API_KEY',
  credentialState: 'configured',
  capabilities: ['Text generation', 'Image generation'],
};

const localReady: ProviderConfig = {
  id: 'local',
  name: 'Local gateway',
  enabled: true,
  status: 'configured',
  model: 'offline-mock',
  credentialState: 'not-required',
  capabilities: ['Offline mock contracts'],
};

describe('providerCostBudget', () => {
  it('reports unknown live-provider cost honestly and requires paid-work confirmation', () => {
    const states = buildProviderCostBudgetStates([configuredOpenAi], defaultProviderRegistry);

    expect(states[0]).toMatchObject({
      providerId: 'openai',
      providerName: 'OpenAI',
      cost: {
        availability: 'unknown',
        label: 'Cost unknown',
      },
      rateLimit: {
        status: 'provider-managed',
        label: 'Provider-managed limits',
      },
      budget: {
        requiresConfirmation: true,
        label: 'Confirm paid work per session',
      },
    });
    expect(states[0].cost.detail).toContain('Exact pricing is not stored in this local registry');
    expect(states[0].rateLimit.retryGuidance).toContain('Retry only after provider guidance');
  });

  it('marks the offline mock provider as free and not rate limited by a remote service', () => {
    const states = buildProviderCostBudgetStates([localReady], defaultProviderRegistry);

    expect(states[0]).toMatchObject({
      providerId: 'local',
      cost: {
        availability: 'free',
        label: 'Free/offline',
      },
      rateLimit: {
        status: 'not-applicable',
        label: 'No remote rate limit',
      },
      budget: {
        requiresConfirmation: false,
        label: 'No paid-work confirmation needed',
      },
    });
  });
});
